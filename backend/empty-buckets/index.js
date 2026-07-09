const { S3Client, ListObjectVersionsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const url = require('url');

const s3 = new S3Client();

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const responseData = {};
  let status = 'SUCCESS';

  try {
    // Só esvazia na deleção do stack
    if (event.RequestType === 'Delete') {
      const buckets = event.ResourceProperties.BucketNames || [];
      console.log('Esvaziando buckets:', buckets);

      for (const bucket of buckets) {
        await emptyBucket(bucket);
      }
    }
  } catch (err) {
    console.error('Erro:', err);
    status = 'FAILED';
    responseData.Error = err.message;
  }

  await sendResponse(event, context, status, responseData);
};

async function emptyBucket(bucket) {
  console.log(`Esvaziando bucket: ${bucket}`);

  let isTruncated = true;
  let keyMarker, versionIdMarker;

  while (isTruncated) {
    const listResponse = await s3.send(new ListObjectVersionsCommand({
      Bucket: bucket,
      KeyMarker: keyMarker,
      VersionIdMarker: versionIdMarker,
    }));

    const objects = [
      ...(listResponse.Versions || []),
      ...(listResponse.DeleteMarkers || []),
    ];

    if (objects.length > 0) {
      const deleteParams = {
        Bucket: bucket,
        Delete: {
          Objects: objects.map(obj => ({
            Key: obj.Key,
            VersionId: obj.VersionId,
          })),
          Quiet: true,
        },
      };

      await s3.send(new DeleteObjectsCommand(deleteParams));
      console.log(`Deletados ${objects.length} objetos de ${bucket}`);
    }

    isTruncated = listResponse.IsTruncated;
    keyMarker = listResponse.NextKeyMarker;
    versionIdMarker = listResponse.NextVersionIdMarker;
  }

  console.log(`Bucket ${bucket} esvaziado.`);
}

async function sendResponse(event, context, status, data) {
  const body = JSON.stringify({
    Status: status,
    Reason: `Ver logs em CloudWatch: ${context.logGroupName}`,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: data,
  });

  const parsed = url.parse(event.ResponseURL);
  const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.path,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': body.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, resolve);
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
