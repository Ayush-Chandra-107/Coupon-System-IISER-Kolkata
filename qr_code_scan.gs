// qr_code_scan.gs

// This script creates a web application to be used as a QR code scanner for event check-ins.
// It consists of two main parts:
// 1. A frontend server (`doGet`) that displays the scanner interface from an HTML file.
// 2. A backend function (`sendback`) that processes the scanned data, validates it against a
//    spreadsheet, updates the attendance status, and returns the result to the scanner interface.

// --- Global Variables ---
// Get the currently active Google Spreadsheet. This is defined globally so it can be accessed by all functions.
var ss = SpreadsheetApp.getActiveSpreadsheet();
// Get the specific sheet named 'Scan'. This sheet contains the unique IDs and attendance status.
var sheet = ss.getSheetByName('Scan');

/**
 * This is a special function that runs when a user accesses the web app's URL.
 * It serves the HTML page for the scanner interface.
 * @returns {HtmlOutput} The HTML page to be displayed in the browser.
 */
function doGet() {
  // Create an HTML template from the file named 'scanner.html' in the same Apps Script project.
  var tmpl = HtmlService.createTemplateFromFile('scanner');
  // Evaluate the template (process any scriptlets) and return it as a complete HTML page.
  // .setTitle() sets the title that appears in the browser tab.
  return tmpl.evaluate().setTitle('scanner');
}

/**
 * This is the backend function called by the client-side JavaScript in the scanner HTML.
 * It receives the data from the scanned QR code, finds the corresponding entry in the
 * 'Scan' sheet, updates the status, and sends a response back.
 * @param {string} x The text content decoded from the scanned QR code (expected to be the Unique ID/UTR).
 * @returns {string} A status message to be displayed on the scanner page ("veg", "nonveg", "error", or "UTR not recognised").
 */
function sendback(x) {
  // Get all values from column A (where the unique IDs are stored).
  var data = sheet.getRange('A:A').getValues();
  // Initialize a variable 'y' to -1. This will be used to store the row number if a match is found.
  var y = -1;

  // Loop through each row of the data fetched from column A.
  for (var i = 0; i < data.length; i++) {
    // Check if the value in the current row (data[i][0]) matches the scanned QR code data (x).
    if (data[i][0] == x) {
      y = i + 1; // If a match is found, set y to the actual sheet row number (array index i is 0-based, sheet rows are 1-based).
      break;     // Exit the loop since we've found our match.
    }
  }

  // --- Process the result of the search ---
  // Check if a matching row was found (i.e., if y is no longer -1).
  if (y !== -1) {
    // A matching UTR was found. Now check the attendance status in column B of that row.
    if (sheet.getRange(y, 2).getValue() == 'no') {
      // If the status is 'no', the person has not been checked in yet.
      sheet.getRange(y, 2).setValue('yes'); // Update the status in column B to 'yes'.
      
      // Check the food preference in column C of the same row.
      if (sheet.getRange(y, 3).getValue() == 'Veg') {
        // If the preference is 'Veg', return "veg" to the web app.
        return "veg";
      }
      else if (sheet.getRange(y, 3).getValue() == 'Non-veg'){
        // If the preference is 'Non-veg', return "nonveg".
        return "nonveg";
      }
    } else {
      // If the status in column B was already 'yes', this is a duplicate scan.
      return "error";  // Return "error" to indicate a previously used coupon.
    }
  } else {
    // If the loop completes and y is still -1, the scanned UTR was not found in column A.
    return "UTR not recognised"; // Return a message indicating the QR code is invalid.
  }
}
