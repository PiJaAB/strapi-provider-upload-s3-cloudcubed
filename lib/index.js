'use strict';

/**
 * Module dependencies
 */

/* eslint-disable no-unused-vars */
// Public node modules.
const _ = require('lodash');
const AWS = require('aws-sdk');

const trimParam = str => (typeof str === 'string' ? str.trim() : undefined);

const bucketRegionMap = {
  'cloud-cube': 'us-east-1',
  'cloud-cube-eu': 'eu-west-1',
  'cloud-cube-jp': 'ap-northeast-1',
};

module.exports = {
  provider: 'aws-s3-cloudcubed',
  name: 'CloudCube/AWS-S3',
  auth: {
    public: {
      label: 'Access API Token',
      type: 'text',
    },
    private: {
      label: 'Secret Access Token',
      type: 'text',
    },
    cubeUrl: {
      label: 'Cube URL',
      type: 'text',
    },
    basePath: {
      label: 'Base Path',
      type: 'text',
    }
  },
  init: config => {
    // configure AWS S3 bucket connection
    const cubeUrl = process.env[config.cubeUrl] ? process.env[config.cubeUrl] : config.cubeUrl;
    const publicKey = process.env[config.public] ? process.env[config.public] : config.public;
    const privateKey = process.env[config.private] ? process.env[config.private] : config.private;
    
    const [, bucket, cube] = cubeUrl.match(/^https:\/\/(.+)\.s3\.amazonaws\.com\/(.+)$/);
    const fileRegex = new RegExp(`https:\\/\\/[^\\/]+\\/(${cube}\\/.*)`);
    const region = bucketRegionMap[bucket];

    AWS.config.update({
      accessKeyId: trimParam(publicKey),
      secretAccessKey: trimParam(privateKey),
      region: region,
    });

    const S3 = new AWS.S3({
      apiVersion: '2006-03-01',
      params: {
        Bucket: trimParam(bucket),
      },
    });

    return {
      upload: file => {
        return new Promise((resolve, reject) => {
          // upload file on S3 bucket
          const path = file.path ? `${file.path}/` : '';
          S3.upload(
            {
              Key: `${cube}/${config.basePath ? config.basePath + '/' : ''}${path}${file.hash}${file.ext}`,
              Body: new Buffer(file.buffer, 'binary'),
              ACL: 'public-read',
              ContentType: file.mime,
              CacheControl: `max-age=${31536000}`
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }

              // set the bucket file url
              file.url = data.Location;

              resolve();
            }
          );
        });
      },
      delete: file => {
        return new Promise((resolve, reject) => {
          // delete file on S3 bucket
          
          const filePath = (file.url.match(fileRegex) || [])[1];
          if(typeof filePath === 'undefined') return reject(new Error('file url does not seem to match configured bucket.'))
          S3.deleteObject(
            {
              Key: filePath,
            },
            (err, data) => {
              if (err) {
                return reject(err);
              }

              resolve();
            }
          );
        });
      },
    };
  },
};