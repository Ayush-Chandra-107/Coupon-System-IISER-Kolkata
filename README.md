# Couponing System with Google Forms, Sheets, and QR Code Scanning

This repository provides a complete solution for managing a couponing system using Google Forms, Google Sheets, Google Apps Script, and QR code scanning. The system collects user data via a Google Form, stores it in a Google Spreadsheet, generates a QR code, sends it via email, and verifies scans using a QR code scanner.

## Prerequisites

- Google Account
- Access to Google Forms, Google Sheets, and Google Apps Script
- Basic understanding of Google Apps Script

## Step-by-Step Guide

### Step 1: Create a Google Form

1. Go to [Google Forms](https://forms.google.com).
2. Click on the `+ Blank` form to create a new form.
3. Add the following fields to your form:
   - Name (Short Answer)
   - Roll Number (Short Answer)
   - Email (Short Answer)
   - UTR Number (Short Answer)
   - Food Preference (Multiple Choice or Dropdown)
     - This had three options in my case, the first two don't matter but the third one has a reference in the code (`qr_generate+mail.gs`):
       - a. Non-Veg
       - b. Veg
       - c. No food
     - For option c, no mail was sent, no QR code was generated, and no UTR was stored in the list for scanning. You may change this as per your need in `qr_generate+mail.gs`.
   
4. After completing the form, click on the "Responses" tab and select the green Google Sheets icon to link your form to a new Google Spreadsheet. Name the sheet appropriately (e.g., `Form Responses 1`).

### Step 2: Link Google Sheets

Once the form is linked to a spreadsheet:

1. Open the spreadsheet linked to your Google Form.
2. Name the sheet where responses are saved as `Form Responses 1`.
3. Create another sheet in the same spreadsheet and name it `Scan`. This sheet will store the UTR numbers and their scan status.

### Step 3: Add Google Apps Script

1. Open your spreadsheet.
2. From the toolbar, click on `Extensions` > `Apps Script`. This will open the Google Apps Script editor.
3. In the editor, create three separate files and paste the respective code from this repository.
   
   - **File 1: `qr_code_scan.gs`**
     - Paste the code provided in the `qr_code_scan.gs` file.
     - This code handles the verification of scanned QR codes and checks whether the UTR number has already been used.

   - **File 2: `qr_generate+mail.gs`**
     - Paste the code provided in the `qr_generate+mail.gs` file.
     - You need to edit a few thigs like the column numbers for different responses(at the top), mail body and subject.
     - This code generates a QR code for the user's UTR number and sends an auto-generated email with the QR code.
   
   - **File 3: `scanner.html`**
     - Create an HTML file and paste the code provided in the `scanner.html` file.
     - This code sets up the front-end interface for scanning the QR codes using the camera.

### Step 4: Set Up Triggers

1. In the Apps Script editor, click on the clock icon (Triggers) on the left sidebar.
2. Click `+ Add Trigger`.
3. Set the trigger for `onFormSubmit` in `qr_generate+mail.gs`:
   - Select function: `onFormSubmit`
   - Select event source: `From form`
   - Select event type: `On form submit`
   
This will ensure that the QR code and email are generated and sent automatically whenever a new form response is submitted.

### Step 5: Deploy the QR Code Scanner

1. In the Apps Script editor, go to the `Deploy` menu and select `Test deployments` > `Deploy as web app`.
2. Set the access permissions to "Anyone".
3. Copy the web app URL provided after deployment.
4. This URL can now be used to scan QR codes and check UTR validity.

### Step 6: Testing the System

1. Submit a form response.
2. Check your email for the QR code and other details.
3. Visit the deployed web app (scanner) and scan the QR code to verify.
4. If the UTR number is not recognized, has already been scanned, or is valid, you will receive the respective message.

### Scanning

1. Open the URL you generated after deploying the QR code scanner.
2. Give the required camera permisiions.
3. Choose back camera from the dropdown menu for convenience.
4. Select start scanning.
5. Each successful scan will lead to a popup, select 'ok' to close it and continue scanning.
6. Same code won't be scanned twice in a row. You need to scan a seperate QR before reattempting to scan a code for the 2nd time.

## Remember

- **Permissions**: Ensure that the web app is set to allow anyone to access. This will allow the QR code scanner to function publicly without issues. Also, someone using the scanner needs permission to edit your spreadsheet.
- **Form Fields**: Make sure the form field order in your Google Form matches the column reference in the scripts.
- **Testing**: Before using the system live, thoroughly test the form submission, email sending, and QR code scanning to ensure all parts are working smoothly.
- **UTR Tracking**: The second sheet, `Scan`, will track all UTR numbers and their scan status. It’s important that this sheet is not modified manually to avoid breaking the system.

## Collaborations

I have taken the code for QR code scanner from [Minhaz](https://github.com/mebjas/html5-qrcode/tree/master/examples/html5) — huge shoutout to him. His work is really great.

For any questions or further assistance, contact:  
**ac22ms107@iiserkol.ac.in**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
