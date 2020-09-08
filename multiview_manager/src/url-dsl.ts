export class UrlDsl {

	public static resolve(url: string) {
		const urlParts: string[][] = [];
		const modifiers: [number, Modifier, number][] = [];
		let lastModifierIndex = 0;
		for (let i = 0; i < url.length; i++) {
            if (url.charAt(i) === '{') {
                let endIndex = url.indexOf('}', i);
                if (url.charAt(endIndex + 1) === '[') endIndex = url.indexOf(']', i);
				endIndex++;
				urlParts.push([url.substring(lastModifierIndex, i)], [''])
				modifiers.push([urlParts.length - 1, new Modifier(url.substring(i, endIndex)), modifiers.length]);
				lastModifierIndex = endIndex;
            }
		}
		urlParts.push([url.substring(lastModifierIndex)]);
		
		const multiplicativeOperations = modifiers.filter(x => x[1].isMultiplicative());
        for (const operation of multiplicativeOperations) urlParts[operation[0]] = operation[1].values()

		const elementwiseOperationsPath = modifiers.filter(x => x[1].isElementwise() && x[1].isRenderable());

		let urlResults = []
		if (elementwiseOperationsPath.length != 0) {
			const elementwiseElements = elementwiseOperationsPath[0][1].values().length;
			for (const operation of elementwiseOperationsPath) if (operation[1].values().length != elementwiseElements) throw `SyntaxError: All elementwise sets must contain the same number of items (${elementwiseElements}/${elementwiseOperationsPath[0][1].getOriginal()} vs ${operation[1].values().length}/${operation[1].getOriginal()})`
			
			const urlsOut: string[] = [];

			for (let i = 0; i < elementwiseElements; i++) {
				const elementwiseHttpPath: string[][] = JSON.parse(JSON.stringify(urlParts));
				for (let operation of elementwiseOperationsPath) elementwiseHttpPath[operation[0]] = [operation[1].values()[i]]
				urlsOut.push(...this.deepCrossJoin(elementwiseHttpPath));
			}

			urlResults = urlsOut
		} else {
			urlResults = this.deepCrossJoin(urlParts)
		}

		const elementwiseOperationsName = modifiers.filter(x => x[1].isElementwise());

		let nameResults: string[] = [];
		if (elementwiseOperationsName.length != 0) {
			const elementwiseElements = elementwiseOperationsName[0][1].values(true).length;
			const namesOut: string[] = [];
			const nameObjects = modifiers.map(x => x[1].getNames());
			const names = nameObjects.map(x => x[0]);
			const namesOrder = nameObjects.map(x => x[1]);
			for (let i = 0; i < elementwiseElements; i++) {
				const namesCopy = JSON.parse(JSON.stringify(names));
				for (let operation of elementwiseOperationsName) {
					namesCopy[operation[2]] = [namesCopy[operation[2]][i]]
				}
				namesOut.push(...this.doMultiplicativeNameResolution(namesCopy, namesOrder))
			}

			nameResults = namesOut
		} else {
			const nameObjects = multiplicativeOperations.map(x => x[1].getNames())
			const names = nameObjects.map(x => x[0]);
			const namesOrder = nameObjects.map(x => x[1]);
			nameResults = this.doMultiplicativeNameResolution(names, namesOrder)
		}

		return [urlResults, nameResults]
	}

	private static doMultiplicativeNameResolution(names: string[][], order: number[]): string[] {
		let namesOrder: [number, number][] = [];
		for (let i = 0; i < order.length; i++) namesOrder.push([i, order[i]]);
		namesOrder = namesOrder.sort((a,b) => a[1] - b[1]);
		const crossResults = this.deepCross(names);
		return crossResults.map(x => {
			let strOut = '';
			for (let part of namesOrder) {
				strOut += x[part[0]]
			}
			return strOut;
		})
	}

	public static deepCrossJoin(array: string[][]): string[] {
		if (array.length == 0) return [];

		const out = []
		for (let entry of array[0]) {
			const next = this.deepCrossJoin(array.slice(1));
			if (next.length == 0) {
				out.push(entry);
				continue;
			}
			for (let append of next) {
				out.push(entry + append);
			}
		}

		return out;
	}

	public static deepCross(array: string[][]): string[][] {
		if (array.length == 0) return [];
		const out: string[][] = [];
		for (let entry of array[0]) {
			const next = this.deepCross(array.slice(1));
			if (next.length == 0) {
				out.push([entry]);
				continue;
			}
			for (let append of next) out.push([entry, ...append]);
		}
		return out;
	}

}

class Modifier {
    private readonly originalModifier: string;
    private readonly subValues: string[];
    private readonly flags: string[];

    constructor(modifier: string) {
        this.originalModifier = modifier;
        this.subValues = modifier.substring(1, modifier.indexOf('}')).split(',');
        const flagIndexStart = modifier.indexOf('[')
        if (flagIndexStart != -1) this.flags = modifier.substring(flagIndexStart + 1, modifier.indexOf(']')).split(',')
        else this.flags = [];
    }

    public isMultiplicative(): boolean {
        const mIndex = this.flags.indexOf('m');
        const eIndex = this.flags.indexOf('e');

        if (mIndex != -1 && eIndex != -1) throw `SyntaxError: modifier cannot both be multiplicative and elementwise (${this.originalModifier})`;
        else if (eIndex != -1) return false;
        else return true; // default is multiplicative
    }

    public isElementwise(): boolean {
        return !this.isMultiplicative();
    }

	public isRenderable(): boolean {
		return this.flags.findIndex(v => v.toLowerCase() === 'dnr') == -1
	}

    public values(getDoNotRender: boolean = false): string[] {
		if (getDoNotRender) return this.subValues;
		else if (!this.isRenderable()) return [];
		else return this.subValues;
	}
	
	public getOriginal(): string {
		return this.originalModifier;
	}

	public getNames(): [string[], number] {
		if (this.flags.indexOf('n') == -1) return [this.values().map(x => ''), -1];
		else {
			const names = [];
			const nCapitalIndex = this.flags.findIndex(v => v.toLowerCase() === 'nc');
			const nLowerIndex = this.flags.findIndex(v => v.toLowerCase() === 'nl');
			const nPrependIndex = this.flags.findIndex(v => v.toLowerCase().startsWith('npre='));
			const nPostpendIndex = this.flags.findIndex(v => v.toLowerCase().startsWith('npost='));
			const nOrderIndex = this.flags.findIndex(v => v.toLowerCase().startsWith('norder='));

			if (nCapitalIndex != -1 && nLowerIndex != -1) throw `SyntaxError: modifier name cannot both be lower (nl) and upper case (nc) (${this.originalModifier})`;

			let nPrepend = '';
			let nPostpend = '';
			if (nPrependIndex != -1) nPrepend = this.flags[nPrependIndex].substring(5);
			if (nPostpendIndex != -1) nPostpend = this.flags[nPostpendIndex].substring(6);

			let nOrder = Infinity;
			if (nOrderIndex != -1) {
				nOrder = parseFloat(this.flags[nOrderIndex].substring(7));
			}

			if (isNaN(nOrder)) throw `SyntaxError: modifier order must be a valid not NaN float or empty (norder)`;
			
			for (let value of this.values(true)) names.push(`${nPrepend}${(nCapitalIndex != -1 ? value.toUpperCase() : ((nLowerIndex != -1 ? value.toLowerCase() : value)))}${nPostpend}`)
			
			return [names, nOrder];
		}
	}

}