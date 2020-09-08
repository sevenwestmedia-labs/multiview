import ioredis from 'ioredis'
import child_process from 'child_process'

export class FfmpegInstance {

    private readonly redis: ioredis.Redis;
    private readonly keepAliveToken: string;
    private readonly imAliveToken: string;
    private readonly imAliveTokenValue: string;
    private readonly heartbeatInterval: NodeJS.Timeout;
    private readonly ffmpegProcess: child_process.ChildProcessWithoutNullStreams;

    constructor(commands: string[] | string, redis: ioredis.Redis, keepAliveToken: string, imAliveToken: string, imAliveTokenValue: string, currentActiveFfmpegInstances: {count: number}) {
        currentActiveFfmpegInstances.count++;
        this.redis = redis;
        this.keepAliveToken = keepAliveToken;
        this.imAliveToken = imAliveToken;
        this.imAliveTokenValue = imAliveTokenValue;
        this.heartbeatInterval = setInterval(() => this.intervalFunction(), 1000);
        this.ffmpegProcess = child_process.spawn('ffmpeg', (Array.isArray(commands) ? commands : [ commands ]));
        this.ffmpegProcess.stderr.on('data', (d) => {
            redis.publish(imAliveToken, d);
        });
        this.ffmpegProcess.on('exit', (e) => {
            currentActiveFfmpegInstances.count--;
            console.log(`Ffmpeg process ended ${e} for commands: ${commands}`)
            clearInterval(this.heartbeatInterval)
        });
    }

    private async intervalFunction() {
        const keepAlive = await this.updateHeartbeat();
        if (!keepAlive) {
            clearInterval(this.heartbeatInterval);
            console.log(`Termination request received...`);
            console.log(`Terminated: ${this.ffmpegProcess.kill("SIGKILL")}`);
        }
    }

    private async updateHeartbeat(): Promise<boolean> {
        const keepAliveExists = await this.redis.exists(this.keepAliveToken);

        if (!keepAliveExists) {
            console.log(`Terminating as keep alive request does not exist: ${this.keepAliveToken}`);
            this.redis.del(this.imAliveToken)
            return false;
        }

        await this.redis.set(this.imAliveToken, this.imAliveTokenValue, 'EX', 5, 'NX');
        const imAliveValue = await this.redis.get(this.imAliveToken);
        if (imAliveValue == this.imAliveTokenValue || imAliveValue == null) {
            await this.redis.expire(this.imAliveToken, 5);
            return true;
        } else {
            console.log(`Terminating as suspected there exists more than 1 instance for key ${this.imAliveToken}, I'm ${this.imAliveTokenValue} but found ${imAliveValue}`)
            return false;
        }
    }

}