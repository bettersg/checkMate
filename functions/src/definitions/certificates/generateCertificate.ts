// functions/src/definitions/certificates/generateCertificate.ts
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import fs from "fs";
import * as path from "path"; // For file path handling

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Function to read HTML file template from the same folder
async function readHtmlTemplate(): Promise<string> {
  const templatePath = path.join(__dirname, 'template.html'); // Correct path
  return fs.readFileSync(templatePath, 'utf8'); // Read the HTML template as a string
}

// Function to generate HTML with dynamic content
async function generateHtml(userName: string, issuanceDate: string, userId: string): Promise<string> {
  let htmlTemplate = await readHtmlTemplate();

  // Replace all instances of the placeholders with the actual userName, issuanceDate, and certificateId
  htmlTemplate = htmlTemplate.replace(/{{userName}}/g, userName);  // Global replacement for all userName placeholders
  htmlTemplate = htmlTemplate.replace('{{issuanceDate}}', issuanceDate);
  htmlTemplate = htmlTemplate.replace('{{certificateId}}', userId); 

  return htmlTemplate;
}


// Function to upload HTML file to Firebase Storage
async function uploadHtmlFile(htmlContent: string, userId: string) {
  const certificateBucketName =
    process.env.ENVIRONMENT === "UAT"
      ? "checkmate-certificates-uat"
      : "checkmate-certificates";

  const storageBucket = admin.storage().bucket(certificateBucketName);
  const filename = `${userId}.html`;
  const file = storageBucket.file(filename);
  const stream = file.createWriteStream({
    metadata: {
      contentType: "text/html",
    },
  });

  return new Promise<string>((resolve, reject) => {
    stream.on("error", (err) => {
      console.error("Error uploading HTML file:", err);
      reject(err);
    });
    stream.on("finish", async () => {
      try {
        const publicUrl = `https://storage.googleapis.com/${storageBucket.name}/${filename}`;
        console.log("HTML file made public at:", publicUrl);
        resolve(publicUrl);
      } catch (err) {
        console.error("Error making HTML file public:", err);
        reject(err);
      }
    });
    stream.end(htmlContent);
  });
}

// Exported function to generate and upload the HTML
export async function generateAndUploadCertificate(
  userId: string,
  userName: string,
  issuanceTimestamp: admin.firestore.Timestamp
) {
  // Format the issuance date inside the function
  const issuanceDate = issuanceTimestamp.toDate().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  console.log(`Generating HTML for user: ${userName} (${userId}) with issuance date: ${issuanceDate}`);
  
  // Generate dynamic HTML with userName and formatted issuanceDate
  const htmlContent = await generateHtml(userName, issuanceDate, userId); 
  
  // Upload the generated HTML to Firebase Storage
  const publicUrl = await uploadHtmlFile(htmlContent, userId); 
  
  console.log(`HTML uploaded for user: ${userName} (${userId}) to ${publicUrl}`);
  
  return publicUrl;
}


