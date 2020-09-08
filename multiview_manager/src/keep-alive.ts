import ioredis from 'ioredis';
import { Store } from './store';
import { StreamPair, MosaicCommand } from './mosaic-command';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { FfmpegService } from './ffmpeg-service';
import { CloudWatch } from 'aws-sdk';

const cw = new CloudWatch();

export class KeepAlive {

    private readonly redis: ioredis.Redis;
    private readonly store: Store;
    private readonly manifestAndSegmentPath: string;
    private readonly frameManagerFullPath: string;
    private readonly ffmpegGrabberService: FfmpegService;
    private readonly ffmpegStitcherService: FfmpegService;
    private readonly lastPushedStitchers = [0, 0];
    private readonly lastSetStitcherCapacity = 0;
    private readonly lastPushedGrabbers = [0, 0];
    private readonly lastSetGrabberCapacity = 0;

    constructor(redis: ioredis.Redis, store: Store, manifestAndSegmentPath: string, frameManagerFullPath: string, ffmpegGrabberService: FfmpegService, ffmpegStitcherService: FfmpegService) {
        this.redis = redis;
        this.store = store;
        this.manifestAndSegmentPath = manifestAndSegmentPath;
        this.frameManagerFullPath = frameManagerFullPath;
        this.ffmpegGrabberService = ffmpegGrabberService;
        this.ffmpegStitcherService = ffmpegStitcherService;
        setInterval(() => this.updateGrabberStatus(), 15000);
        setInterval(() => this.updateStitcherStatus(), 15000);
    }

    public async keepAlive(streamKey: string) {
        const configPotential = await this.redis.get(`config:${streamKey}`);
        let config: StreamPair[] | undefined;
        if (configPotential == null) {
            config = await this.store.get(streamKey);
            if (config == undefined) throw `Config not found for ${streamKey} (config:${streamKey})`
            this.redis.set(`config:${streamKey}`, JSON.stringify(config));
        } else {
            config = JSON.parse(configPotential);
        }

        this.keepAliveStitcher(streamKey, config!).then(() => this.updateStitcherStatus());
        Promise.all(config!.map(x => this.keepAliveFrameGrabber(x))).then(() => this.updateGrabberStatus());
    }

    public async keepAliveStitcher(streamKey: string, config: StreamPair[]) {
        this.redis.set(`keepalive:stitcher:${streamKey}`, `TRUE`, `EX`, 60);

        const minuteTimestamp = this.get5MinuteTimestamp();
        this.redis.pfadd(`hll:stitchers:${minuteTimestamp}`, streamKey);
        this.redis.expireat(`hll:stitchers:${minuteTimestamp}`, minuteTimestamp / 1000 + 300);

        const myId: string = uuidv4();
        const z = await this.redis.set(`revive:stitcher:${streamKey}`, myId, `EX`, 5, `NX`);
        const reviveDuty = z == 'OK';
        if (!reviveDuty) return;
        if (!await this.redis.exists(`alive:stitcher:${streamKey}`)) {
            const ffmpegUrl = await this.ffmpegStitcherService.resolveFfmpegInstance();
            console.log(`Not alive! alive:stitcher:${streamKey}, using ${ffmpegUrl}`)

            let params = '';

            if (config.length <= 4) {
                params = '&width=640&height=360';
            } else if (config.length <= 9) {
                params = '&width=512&height=288';
            } else if (config.length <= 16) {
                params = '&width=384&height=216';
            } else {
                params = '&width=256&height=144';
            }

            const wrappedSources = config.map(x => {
                return Object.assign({}, x, { source: `${this.frameManagerFullPath}${crypto.createHash('md5').update(x.source).digest("hex")}${params}` })
            });

            const mosaicCommandResult = MosaicCommand.generateMosaic(wrappedSources, `${this.manifestAndSegmentPath}/${streamKey}/index.m3u8`);
            const x = await fetch(`http://${ffmpegUrl}/?kat=keepalive:stitcher:${streamKey}&iat=alive:stitcher:${streamKey}&iatv=${uuidv4()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mosaicCommandResult)
            });
            console.log(await (x).text())
        }
    }

    public async keepAliveFrameGrabber(stream: StreamPair) {
        const streamKey = crypto.createHash('md5').update(stream.source).digest("hex")
        this.redis.set(`keepalive:grabber:${streamKey}`, `TRUE`, `EX`, 60);

        const minuteTimestamp = this.get5MinuteTimestamp();
        this.redis.pfadd(`hll:grabbers:${minuteTimestamp}`, streamKey);
        this.redis.expireat(`hll:grabbers:${minuteTimestamp}`, minuteTimestamp / 1000 + 300);

        const myId: string = uuidv4();
        const z = await this.redis.set(`revive:grabber:${streamKey}`, myId, `EX`, 5, `NX`);
        const reviveDuty = z == 'OK';
        if (!reviveDuty) return;
        if (!await this.redis.exists(`alive:grabber:${streamKey}`)) {
            const ffmpegUrl = await this.ffmpegGrabberService.resolveFfmpegInstance();
            console.log(`Not alive! alive:grabber:${streamKey} , using ${ffmpegUrl}`)
            const mosaicCommandResult = MosaicCommand.pushStream(stream.source, this.frameManagerFullPath);
            const x = await fetch(`http://${ffmpegUrl}/?kat=keepalive:grabber:${streamKey}&iat=alive:grabber:${streamKey}&iatv=${uuidv4()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(mosaicCommandResult)
            });
            console.log(await (x).text())
        }
    }

    private get5MinuteTimestamp() {
        const x = Date.now();
        return x - (x % (5 * 60000));
    }

    private async updateStitcherStatus() {
        const minuteTimestamp = this.get5MinuteTimestamp();
        const pfcount = await this.redis.pfcount(`hll:stitchers:${minuteTimestamp}`);
        const previousPfCount = await this.redis.pfcount(`hll:stitchers:${minuteTimestamp - 300000}`);

        const targetCapacity = Math.ceil((Math.max(pfcount, previousPfCount) + 1) / 1); //Todo: change /1 to variable

        if (this.lastSetStitcherCapacity != targetCapacity) {
            this.lastSetStitcherCapacity == targetCapacity;
            this.ffmpegStitcherService.setCapacity(targetCapacity);
        }

        if (this.lastPushedStitchers[0] == minuteTimestamp && this.lastPushedStitchers[1] == pfcount) return;

        this.lastPushedStitchers[0] = minuteTimestamp;
        this.lastPushedStitchers[1] = pfcount;

        cw.putMetricData({
            Namespace: 'Multiview',
            MetricData: [
                {
                    MetricName: 'RequiredEncodingProcesses',
                    Value: pfcount,
                    Dimensions: [
                        {
                            Name: 'Type',
                            Value: 'Stitcher'
                        }
                    ]
                }
            ]
        }, (err) => {
            if (err != null) {
                console.log(`Error occured pushing CW metrics: ${err}`);
            }
        });
    }

    private async updateGrabberStatus() {
        const minuteTimestamp = this.get5MinuteTimestamp();
        const pfcount = await this.redis.pfcount(`hll:grabbers:${minuteTimestamp}`);
        const previousPfCount = await this.redis.pfcount(`hll:grabbers:${minuteTimestamp - 300000}`);

        const targetCapacity = Math.ceil((Math.max(pfcount, previousPfCount) + 1) / 21); //Todo: change /21 to variable

        if (this.lastSetGrabberCapacity != targetCapacity) {
            this.lastSetGrabberCapacity == targetCapacity;
            this.ffmpegGrabberService.setCapacity(targetCapacity);
        }

        if (this.lastPushedGrabbers[0] == minuteTimestamp && this.lastPushedGrabbers[1] == pfcount) return;

        this.lastPushedGrabbers[0] = minuteTimestamp;
        this.lastPushedGrabbers[1] = pfcount;

        cw.putMetricData({
            Namespace: 'Multiview',
            MetricData: [
                {
                    MetricName: 'RequiredEncodingProcesses',
                    Value: pfcount,
                    Dimensions: [
                        {
                            Name: 'Type',
                            Value: 'Grabber'
                        }
                    ]
                }
            ]
        }, (err) => {
            if (err != null) {
                console.log(`Error occured pushing CW metrics: ${err}`);
            }
        });
    }

}