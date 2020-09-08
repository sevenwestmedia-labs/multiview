import express from 'express'
import bodyParser from 'body-parser';
import { FfmpegInstance } from './ffmpeg_instance';
import IORedis from 'ioredis';
import { CloudWatch } from 'aws-sdk';
import os from 'os';
if (isNaN(parseFloat(process.env.PORT!))) throw `Environment parameter PORT must be set`;
if (isNaN(parseFloat(process.env.MAX_FFMPEG_INSTANCES!))) throw `Environment parameter MAX_FFMPEG_INSTANCES must be set`;
if (parseInt(process.env.MAX_FFMPEG_INSTANCES!) < 1) throw `Environment parameter MAX_FFMPEG_INSTANCES must be at least 1`;
if (process.env.FFMPEG_TYPE == undefined) throw `Environment paramter FFMPEG_TYPE must be set`;

const hostname = os.hostname();
const cw = new CloudWatch();
const app = express();
app.use(bodyParser.json({}));
const port = parseFloat(process.env.PORT!)
const redis = new IORedis(6379, process.env.REDIS_HOST);
const maxActiveFfmpegInstances = parseInt(process.env.MAX_FFMPEG_INSTANCES!);
const currentActiveFfmpegInstances = { count: 0 }; // Object for pass by reference, using normal int here would pass by value
console.log(`My host name is ${hostname}`);
app.post('/', (req, res) => {
    if (currentActiveFfmpegInstances.count >= maxActiveFfmpegInstances) {
        res.status(400);
        res.send(`Current active ffmpeg instances ${currentActiveFfmpegInstances.count} is greater than or equal to ${maxActiveFfmpegInstances}`);
        return;
    }

    const commands = req.body
    const keepAliveToken = req.query['kat']
    const imAliveToken = req.query['iat'];
    const imAliveTokenValue = req.query['iatv'];

    console.log(`ffmpeg ${commands.join(" ")}`)

    new FfmpegInstance(commands, redis, keepAliveToken, imAliveToken, imAliveTokenValue, currentActiveFfmpegInstances);
    res.status(200);
    res.send('OKAY');
})
app.get('/health', (req, res) => {
    res.status(200);
    res.send('OKAY');
})
app.listen(port, '0.0.0.0', 1024, () => console.log(`ffprobe as a service listening on ${port}!`));

setInterval(async () => {
    cw.putMetricData({
        Namespace: 'Multiview',
        MetricData: [
            {
                MetricName: 'ActiveEncodingProcesses',
                Value: currentActiveFfmpegInstances.count,
                Dimensions: [
                    {
                        Name: 'Type',
                        Value: process.env.FFMPEG_TYPE!
                    }
                ]
            },
            {
                MetricName: 'AvailableEncodingSlots',
                Value: Math.max(maxActiveFfmpegInstances - currentActiveFfmpegInstances.count, 0),
                Dimensions: [
                    {
                        Name: 'Type',
                        Value: process.env.FFMPEG_TYPE!
                    }
                ]
            }
        ]
    }, (err) => {
        if (err != null) {
            console.log(`Error occured pushing CW metrics: ${err}`);
        }
    })
}, 60000);

setInterval(async () => {
    redis.zadd(`ffmpeg_hosts:${process.env.FFMPEG_TYPE}`, '' + (maxActiveFfmpegInstances - currentActiveFfmpegInstances.count), hostname);
    redis.setex(`host:${hostname}:${process.env.FFMPEG_TYPE}`, 5, 'ALIVE');
}, 1000);