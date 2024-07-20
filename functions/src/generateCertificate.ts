import * as admin from "firebase-admin";
import { createCanvas, loadImage } from "canvas";
import * as functions from "firebase-functions";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function generateCertificateImage(userName: string) {
  const certificateTemplatePath = '/Users/jordanlee/Documents/GitHub/checkMate/functions/src/Certification.jpg'; // Path to your certificate template
  const canvas = createCanvas(800, 600); // Adjust dimensions as needed
  const context = canvas.getContext("2d");

  const templateImage = await loadImage(certificateTemplatePath);
  context.drawImage(templateImage, 0, 0, canvas.width, canvas.height);

  // Add user's name to the certificate
  context.font = 'bold 36px Arial';
  context.fillStyle = '#000'; // Adjust color as needed
  context.textAlign = 'center';
  context.fillText(userName, canvas.width / 2, canvas.height / 2); // Adjust position as needed

  return canvas.toBuffer("image/jpeg");
}

async function uploadCertificateImage(buffer: Buffer, userId: string) {
  const storageBucket = admin.storage().bucket();
  const filename = `certificates/${userId}.jpg`;
  const file = storageBucket.file(filename);
  const stream = file.createWriteStream({
    metadata: {
      contentType: "image/jpeg"
    }
  });

  return new Promise<string>((resolve, reject) => {
    stream.on("error", (err) => {
      console.error("Error uploading certificate image:", err);
      reject(err);
    });
    stream.on("finish", async () => {
      try {
        await file.makePublic(); // Ensure the file is made public
        const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${filename}`;
        console.log("Certificate image made public at:", publicUrl);
        resolve(publicUrl);
      } catch (err) {
        console.error("Error making certificate image public:", err);
        reject(err);
      }
    });
    stream.end(buffer);
  });
}

async function generateAndUploadCertificate(userId: string, userName: string) {
  console.log(`Generating certificate for user: ${userName} (${userId})`);
  const certificateBuffer = await generateCertificateImage(userName);
  console.log(`Certificate image generated for user: ${userName} (${userId})`);
  const publicUrl = await uploadCertificateImage(certificateBuffer, userId);
  console.log(`Certificate image uploaded for user: ${userName} (${userId}) to ${publicUrl}`);
  return publicUrl;
}

export const createCertificateForUser = functions.firestore
  .document('checkers/{userId}')
  .onUpdate(async (change, context) => {
    const userId = context.params.userId;
    const newValue = change.after.data();
    const userName = newValue.name;

    try {
      const certificateUrl = await generateAndUploadCertificate(userId, userName);

      await db.collection('checkers').doc(userId).update({
        certificateUrl: certificateUrl
      });

      console.log(`Certificate generated for user ${userId}: ${certificateUrl}`);
    } catch (err) {
      console.error(`Failed to generate certificate for user ${userId}:`, err);
    }
  });
