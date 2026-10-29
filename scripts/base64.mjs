import { readFile } from 'fs';

// Function to read a file and encode its content to Base64
function readFileAndEncodeBase64(filePath) {
    // Read the file asynchronously
    return new Promise((resolve, reject) => {
        readFile(filePath, (err, data) => {
            if (err) {
                reject(err); // If error, reject the promise with the error
                return;
            }

            // Encode the file content to Base64
            const base64Data = Buffer.from(data).toString('base64');
            resolve(base64Data); // Resolve the promise with the Base64 encoded string
        });
    });
}

// Usage example
const filePath = ''; // Replace with the path to your file
readFileAndEncodeBase64(filePath)
    .then(base64String => {
        console.log('Base64 encoded string\n', base64String);
    })
    .catch(error => {
        console.error('Error:', error);
    });