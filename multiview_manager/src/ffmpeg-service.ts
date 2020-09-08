import ioredis from "ioredis";
import { ECS } from 'aws-sdk';

const ecs = new ECS();

export class FfmpegService {

    private readonly redis: ioredis.Redis;
    private readonly ffmpegService: string;
    private readonly typeTag: string;
    private readonly ecsCluster: string;
    private readonly serviceName: string;

    constructor(redis: ioredis.Redis, ffmpegService: string, typeTag: string, ecsCluster: string, serviceName: string) {
        this.redis = redis;
        this.ffmpegService = ffmpegService;
        this.typeTag = typeTag
        this.ecsCluster = ecsCluster;
        this.serviceName = serviceName;
    }

    public async setCapacity(desiredCapacity: number) {
        ecs.updateService({
            cluster: this.ecsCluster,
            service: this.serviceName,
            desiredCount: desiredCapacity
        }, (err) => {
            if (err != null) {
                console.log(`Error occured updating capacity: ${err}`)
            }
        })
    };

    public async resolveFfmpegInstance(): Promise<string> {
        const hosts = await this.redis.zrangebyscore(`ffmpeg_hosts:${this.typeTag}`, 1, '+inf', "WITHSCORES");
        const potentialHosts = [];

        for (let i = 0; i < hosts.length; i+=2) {
            potentialHosts.push({
                host: hosts[i],
                weight: parseFloat(hosts[i + 1])
            });
        };

        const healthy = await Promise.all(potentialHosts.map(async x => (await this.redis.exists(`host:${x.host}:${this.typeTag}`)) == 1));
        const healthyHosts = potentialHosts.filter((value, index) => healthy[index]);

        console.log(healthyHosts);

        let totalWeight = healthyHosts.map(x => x.weight).reduce((a, b) => a + b, 0);

        const targetIndex = totalWeight * Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < healthyHosts.length; i++) {
            cumulativeWeight += healthyHosts[i].weight;
            console.log(cumulativeWeight);
            console.log(targetIndex)
            if (cumulativeWeight > targetIndex) return healthyHosts[i].host;
        }

        return this.ffmpegService;
    }
}