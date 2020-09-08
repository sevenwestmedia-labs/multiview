import crypto from 'crypto';

export class MosaicCommand {

    public static generateMosaic(streamPairs: StreamPair[], pushDestination: string, frameRate: number = 25, height: number = 720, width: number = 1280, tilesDown: number | null = null, tilesAcross: number | null = null): string[] {
        const pixelsDown = height;
        const pixelsAcross = width;

        let xLen: number;
        let yLen: number;

        if (tilesDown == null && tilesAcross == null) {
            const dims = this.generateDimensions(streamPairs.length, 4/3);
            xLen = dims[1]
            yLen = dims[0]
        } else if (tilesDown == null) {
            yLen = tilesAcross!;
            xLen = Math.ceil(streamPairs.length / yLen)
        } else if (tilesAcross == null) {
            xLen = tilesDown!;
            yLen = Math.ceil(streamPairs.length / xLen)
        } else {
            xLen = tilesDown;
            yLen = tilesAcross;
        }

        if (streamPairs.length > xLen * yLen) throw `Dimensions do not fit all streams! ${xLen}x${yLen} (${streamPairs.length})`

        let argsOut = [];

        for (let stream of streamPairs) {
            argsOut.push(`-f`)
            argsOut.push(`image2`)
            argsOut.push(`-loop`)
            argsOut.push(`1`)
            argsOut.push(`-analyzeduration`)
            argsOut.push(`0`)
            argsOut.push(`-thread_queue_size`)
            argsOut.push(`${streamPairs.length}`)
            argsOut.push(`-re`)
            argsOut.push(`-framerate`)
            argsOut.push(`${5/*frameRate*/}`)
            argsOut.push(`-i`)
            argsOut.push(`${stream.source}`)   
        }

        argsOut.push('-f', 'mpegts', '-filter_complex')

        let filterComplexStr = `nullsrc=size=${pixelsAcross}x${pixelsDown} [bg];\n`

        for (let i = 0; i < streamPairs.length; i++) {
            filterComplexStr += `[${i}:v] setpts=PTS-STARTPTS, scale=${(pixelsAcross / yLen).toFixed(0)}x${(pixelsDown / xLen).toFixed(0)} [v${i}];\n`;
        }

        for (let i = 0; i < xLen; i++) {
            // for each column
            for (let j = 0; j < yLen; j++) {
                // for each row
                if (j * xLen + i > streamPairs.length - 1) break;
                filterComplexStr += `[bg][v${j * xLen + i}] overlay=shortest=1:x=${(j * pixelsAcross / yLen).toFixed(0)}:y=${(i * pixelsDown / xLen).toFixed(0)} [bg];\n`
                filterComplexStr += `[bg] drawtext=fontfile='/tmp/workdir/fonts/Roboto-Light.ttf':text='${streamPairs[j * xLen + i].name}':fontsize=25:fontcolor='yellow':boxcolor=0x000000A0:box=1:x=${(j * pixelsAcross / yLen).toFixed(0)}:y=${(i * pixelsDown / xLen).toFixed(0)} [bg];\n`
            }
        }

        //out = out.substr(0, out.length - 7)
        filterComplexStr += "[bg] drawtext=fontfile='/tmp/workdir/fonts/Roboto-Light.ttf':text='%{localtime}':fontsize=25:fontcolor='yellow':boxcolor=0x000000A0:box=1:x=w-tw:y=h-th"

        argsOut.push(filterComplexStr);

        argsOut.push(`-an`)
        argsOut.push(`-f`)
        argsOut.push(`hls`)
        argsOut.push(`-hls_list_size`)
        argsOut.push(`5`)
        argsOut.push(`-framerate`)
        argsOut.push(`${frameRate}`)
        argsOut.push(`-preset`)
        argsOut.push(`ultrafast`)
        argsOut.push(`-method`)
        argsOut.push(`POST`)
        argsOut.push(`${pushDestination}`);

        return argsOut;
    }

    public static pushStream(streamSource: string, endpoint: string): string[] {
        return [
            `-re`,
            `-i`, 
            streamSource,
            `-update`,
            `1`,
            `-f`,
            `image2`,
            `-flush_packets`,
            `1`,
            `-method`, 
            `POST`,
            `-filter_complex`,
            `[0:a] showvolume=r=10:w=110:h=5:t=0:b=3,transpose=2 [bars]; [0:v] setpts=PTS-STARTPTS [video]; [video] [bars] overlay=shortest=1:x=main_w-15:y=main_h-110`,
            `-r`,
            `5`,
            `${endpoint}${crypto.createHash('md5').update(streamSource).digest("hex")}`
        ]
    }

    public static generateDimensions(streamCount: number, targetRatio: number): [number, number] {
        let currentX = 0;
        let currentY = 0;
        let currentAbsDif = Infinity;

        for (let i = 0; i < streamCount; i++) {
            let virtY = Math.ceil(streamCount / i);
            const dif = Math.abs(targetRatio - i/virtY)

            if (dif < currentAbsDif) {
                currentX = i
                currentY = virtY
                currentAbsDif = dif
            }
        }

        return [currentX, currentY]
    }

}

export interface StreamPair {
    name: string,
    source: string,
    original_source?: string
}