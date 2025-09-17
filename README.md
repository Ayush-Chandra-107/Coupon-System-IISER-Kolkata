# Automated Coupon System with Google Suite & QR Codes

> A complete, serverless solution for creating, distributing, and verifying event coupons. This system uses Google Forms for registration, Google Sheets as a database, and a Google Apps Script-powered web app for real-time QR code scanning.

This system is perfect for managing entry for college events, workshops, or any gathering where you need to track attendance. It automates the entire process from the moment a user registers to when they are checked in at the door.

---

## Features

* **Automated Registration**: Collects attendee information through a simple Google Form.
* **Dynamic QR Code Generation**: Automatically creates a unique QR code for each valid registration.
* **Email Delivery**: Instantly sends a customized HTML email to the attendee with their QR code coupon.
* **Data Segregation**: Automatically sorts attendee data into separate sheets based on criteria like their "batch" or year.
* **Real-Time QR Scanning**: Provides a web-based scanner (accessible via any smartphone camera) to verify coupons.
* **Prevents Duplicate Entries**: The scanner immediately flags already-used or invalid QR codes.

---

## How It Works

The workflow is straightforward:

1.  **Submit Form**: An attendee fills out the Google Form.
2.  **Trigger Script**: The form submission triggers the `onFormSubmit` function in Google Apps Script.
3.  **Process Data**: The script reads the new data, generates a unique QR code using the QuickChart API, and logs the attendee's details in a "Scan" sheet.
4.  **Send Email**: A formatted HTML email containing the QR code coupon is sent to the attendee.
5.  **Scan at Event**: At the event, staff use the deployed web app URL on their phones to scan the attendee's QR code.
6.  **Verify & Update**: The scanner validates the code against the "Scan" sheet, displays the attendee's status (e.g., "✅ Veg Coupon Verified"), and marks the code as used.



---

## Step-by-Step Setup Guide

### Step 1: Create the Google Form

First, we need a way to collect registrations.

1.  Go to [Google Forms](https://forms.google.com) and create a **+ Blank** form.
2.  Add fields to collect attendee information. The following are used in the script, but you can customize them:
    * `Name` (Short Answer)
    * `Batch` (Short Answer, e.g., "MS25")
    * `Email` (Short Answer, with email validation)
    * `Amount Paid` (Short Answer)
    * `UTR Number` (Short Answer) - **This will be encoded in the QR code.**
    * `Food Preference` (Multiple Choice)
3.  Click the **Responses** tab and click the green **Sheets** icon to create a new spreadsheet for the responses.

> **Important Note on "No food" option:**
> The script `qr_generate+mail.gs` is coded to ignore responses where `Food Preference` is set to "No food". It will not generate a QR code, send an email, or log the UTR for scanning. You can change this behavior in the script if needed.

### Step 2: Configure the Google Sheet

Your spreadsheet will act as the database.

1.  Ensure the sheet receiving form answers is named **`Form Responses 1`**.
2.  Create a new, empty sheet in the same spreadsheet and name it **`Scan`**. This sheet will be automatically populated by the script with UTRs and their scan status (`yes`/`no`).
3.  The script will also automatically create new sheets named after the values in your "Batch" column (e.g., a sheet named "MS25") to segregate the data.

### Step 3: Add the Google Apps Scripts

This is where the magic happens.

1.  In your Google Sheet, navigate to `Extensions` > `Apps Script`.
2.  You will see one default file named `Code.gs`. Create two more files by clicking the `+` icon next to "Files". One of them will be an `HTML` file and the other one will be a `Script` file
3.  You should now have three files. Copy the code from this repository into them as follows (Ensure correctly renaming the files):
    * **File 1 (Script): `qr_generate+mail.gs`**
        * Paste the code from the corresponding file. This script handles QR generation and emailing.
    * **File 2 (Script): `qr_code_scan.gs`**
        * Paste the code from the corresponding file. This is the backend for the scanner web app.
    * **File 3 (HTML): `scanner.html`**
        * When creating this file, select **HTML**. Paste the code from `scanner.html`. This is the front-end interface for the scanner.

### Step 4: Set Up the Trigger

This makes the `onFormSubmit` function run automatically.

1.  In the Apps Script editor, click the **Triggers** ⏰ icon in the left sidebar.
2.  Click **+ Add Trigger** in the bottom-right.
3.  Configure the trigger with these **exact settings**:
    * **Choose which function to run**: `onFormSubmit`
    * **Choose which deployment should run**: `Head`
    * **Select event source**: `From spreadsheet`
    * **Select event type**: `On form submit`
4.  Click **Save**. You may need to grant Google permissions for the script to run.

### Step 5: Deploy the QR Scanner Web App

This makes the scanner accessible via a public URL.

1.  In the Apps Script editor, click the blue **Deploy** button and select **New deployment**.
2.  Click the **⚙️ gear icon** ("Select type") and choose **Web app**.
3.  Fill in the deployment details:
    * **Description**: `QR Code Scanner v1`
    * **Execute as**: `Me`
    * **Who has access**: `Anyone` (**Important!** This allows anyone with the link to use the scanner.)
4.  Click **Deploy**.
5.  **Copy the Web app URL**. This is the link you will share with your event staff to scan QR codes.

---

## Usage Guide

### Testing the System

1.  Fill out and submit your Google Form with your own details.
2.  Check your email. You should receive the coupon email within a minute.
3.  Open the deployed Web App URL on your phone's browser.
4.  Scan the QR code from the email.
5.  The web app should display a success message. Try scanning it again (you need to scan a random QR before this, because the app doesn't scan the same QR twice in a row, as discussed ahead)—it should now show an error that the code has already been used.

### Scanning at the Event

1.  Event staff open the Web App URL on their smartphones.
2.  Grant the necessary camera permissions when prompted.
3.  The camera view will appear. Simply point it at an attendee's QR code.
4.  A success or error message will appear at the top of the screen. These messages automatically fade away, so there is no need to close popups.
5.  The scanner is ready for the next code immediately. The system prevents the *exact same code* from being processed twice in a row to avoid accidental double scans.

---

## Important Notes

* **Permissions**: The "Who has access: `Anyone`" setting for the web app **does not** give public access to your spreadsheet. It only allows people to use the scanner. The script runs with *your* permissions (`Execute as: Me`), so the people scanning **do not** need edit access to the sheet.
* **Customization**: If you change the order of columns in your Google Form, you **must update the column numbers** at the top of the `qr_generate+mail.gs` script. You should also customize the `mail_body` variable to match your event details.
* **Redeployment**: If you make any changes to the code (`.gs` or `.html` files), you must **deploy the project again** for the changes to take effect on the live web app. Go to `Deploy` > `Manage deployments`, select your deployment, click the pencil icon, and choose `New version`.

## Acknowledgments

The core HTML5 QR code scanning library was adapted from the excellent work of **[Minhaz Palasara](https://github.com/mebjas/html5-qrcode)**. His library makes browser-based scanning incredibly accessible.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.
