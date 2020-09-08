import express from 'express'
import * as http from './http'
import { UrlDsl } from './url-dsl';
import crypto from 'crypto';
import { Store, MemoryStore, DynamoStore } from './store';
import ioredis from 'ioredis';
import { KeepAlive } from './keep-alive';
import { FfmpegService } from './ffmpeg-service';

if (isNaN(parseFloat(process.env.PORT!))) throw `Environment parameter PORT must be set`;
if (process.env.FFMPEG_SERVICE_GRABBER == undefined) throw `Environment variable FFMPEG_SERVICE_GRABBER is not set`;
if (process.env.FFMPEG_SERVICE_GRABBER_ECS_CLUSTER == undefined) throw `Environment variable FFMPEG_SERVICE_GRABBER_ECS_CLUSTER is not set`;
if (process.env.FFMPEG_SERVICE_GRABBER_ECS_SERVICE_NAME == undefined) throw `Environment variable FFMPEG_SERVICE_GRABBER_ECS_SERVICE_NAME is not set`;
if (process.env.FFMPEG_SERVICE_STITCHER == undefined) throw `Environment variable FFMPEG_SERVICE_STITCHER is not set`;
if (process.env.FFMPEG_SERVICE_STITCHER_ECS_CLUSTER == undefined) throw `Environment variable FFMPEG_SERVICE_STITCHER_ECS_CLUSTER is not set`;
if (process.env.FFMPEG_SERVICE_STITCHER_ECS_SERVICE_NAME == undefined) throw `Environment variable FFMPEG_SERVICE_STITCHER_ECS_SERVICE_NAME is not set`;
if (process.env.DYNAMO_TABLE == undefined) throw `Environment variable DYNAMO_TABLE is not set`;

const objectStoreHostname = `localhost:9090`;
const redis = new ioredis(6379, process.env.REDIS_HOST);
const streamConfigStore: Store = new DynamoStore(process.env.DYNAMO_TABLE);
const ffmpegGrabberResolver = new FfmpegService(redis, process.env.FFMPEG_SERVICE_GRABBER, 'grabber', process.env.FFMPEG_SERVICE_GRABBER_ECS_CLUSTER, process.env.FFMPEG_SERVICE_GRABBER_ECS_SERVICE_NAME);
const ffmpegStitcherResolver = new FfmpegService(redis, process.env.FFMPEG_SERVICE_GRABBER, 'stitcher', process.env.FFMPEG_SERVICE_STITCHER_ECS_CLUSTER, process.env.FFMPEG_SERVICE_STITCHER_ECS_SERVICE_NAME);
const keepAlive = new KeepAlive(redis, streamConfigStore, `http://${objectStoreHostname}/blob`, `http://${objectStoreHostname}/frame?stream=`, ffmpegGrabberResolver, ffmpegStitcherResolver)

const app = express();
app.get(`/create`, async (req, res) => {
    console.log(`Create called`)
    if (req.query == null || req.query.urls == undefined) return http.returnUserError(`Query parameter urls must be provided`)
    const urls: string | string[] = req.query.urls;
    const resolved = (Array.isArray(urls)) ? urls.map(x => UrlDsl.resolve(x)) : [UrlDsl.resolve(urls)];
    const streamPairs = [];
    const dependencies = [];

    for (let i = 0; i < resolved.length; i++) {
        for (let j = 0; j < resolved[i][0].length; j++) {
            streamPairs.push({
                name: (resolved[i][1][j] == undefined) ? '' : resolved[i][1][j],
                source: resolved[i][0][j]
            });
            dependencies.push(resolved[i][0][j])
        }
    }

    const streamKey = crypto.createHash('md5').update(streamPairs.map(x => `${x.name};${x.source}`).sort().join(';;')).digest("hex");
    await streamConfigStore.put(streamKey, streamPairs);

    redis.set(`blob:${Buffer.from(`${streamKey}/index.m3u8`).toString('base64')}`, '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0', 'EX', 90, 'NX'); //prevent instant player failure
    res.redirect(`/play/${streamKey}/index.m3u8`);
});

app.get(`/play/*`, async (req, res) => {
    const keepAliveConfigKey = req.path.substring(req.path.indexOf("play/") + 5, req.path.indexOf('/', req.path.indexOf("play/") + 5));
    keepAlive.keepAlive(keepAliveConfigKey);

    const redisKey = `blob:${Buffer.from(req.path.substring(req.path.indexOf("play/") + 5)).toString('base64')}`;

    try {
        const buf = await redis.getBuffer(redisKey);
        if (buf == null) throw `Key not found`;
        res.setHeader(`Cache-Control`, `max-age=${(req.path.endsWith('.m3u8') ? 1 : (req.path.endsWith('.ts') ? 120 : 0))}`)
        res.setHeader('content-length', buf.length);
        res.send(buf);
        res.end();
    } catch (e) {
        res.sendStatus(404);
    }
});

app.get('/', (req, res) => res.sendStatus(200));

app.listen(parseInt(process.env.PORT!), '0.0.0.0', 1024, () => console.log(`Multiview manager listening on ${parseInt(process.env.PORT!)}`));