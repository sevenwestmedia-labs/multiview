import { StreamPair } from "./mosaic-command";
import { DynamoDB } from "aws-sdk";

export interface Store {
    get: ((streamKey: string) => Promise<StreamPair[] | undefined>);
    put: ((streamKey: string, streamPairs: StreamPair[]) => Promise<void>);
}

export class MemoryStore implements Store {

    private store: { [streamKey: string]: StreamPair[] } = {};

    public async get(streamKey: string): Promise<StreamPair[]> {
        return this.store[streamKey];
    }

    public async put(streamKey: string, streamPairs: StreamPair[]): Promise<void> {
        this.store[streamKey] = streamPairs;
    }

}

const dynamo = new DynamoDB();

export class DynamoStore implements Store {

    private readonly tableName: string;

    constructor(dynamoTableName: string) {
        this.tableName = dynamoTableName;
    }

    public async get(streamKey: string): Promise<StreamPair[] | undefined> {
        const streamItem = await dynamo.getItem({
            TableName: this.tableName,
            Key: {
                streamKey: {
                    S: streamKey
                }
            }
        }).promise();

        if (streamItem.Item == undefined) return undefined;
        return JSON.parse(streamItem.Item.config.S!) as StreamPair[];
    }

    public async put(streamKey: string, streamPairs: StreamPair[]): Promise<void> {
        try {
            const x = await dynamo.putItem({
                TableName: this.tableName,
                Item: {
                    streamKey: {
                        S: streamKey
                    },
                    config: {
                        S: JSON.stringify(streamPairs)
                    }
                }
            }).promise();
            console.log(`Wrote config ${streamKey} to DynamoDB table ${this.tableName}: ${JSON.stringify(x.$response)}`)
        } catch (e) {
            console.log(`Error occured saving ${streamKey} to DynamoDB table ${this.tableName} with exception ${e}`)
        }
    }
}