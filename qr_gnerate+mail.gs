function onFormSubmit(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Form Responses 1');
    var lastRow = sheet.getLastRow();
    //var lastRow = row_no;            //This line is for sending mails manually, in case of any error (keep it as comment until needed. When you want to send manual mails, comment out the previous line, uncomment this line, and change the 'row_no' with actual row no. Remember to change them back once you are finished, otherwise the code will not work as intended anymore)
  
    var email = sheet.getRange(lastRow, 5).getValue();      // Assumes Email is in the fifth column
    var uniqueID = sheet.getRange(lastRow, 7).getValue();      // Assumes Unique ID is in the seventh column
    var recipientName = sheet.getRange(lastRow, 3).getValue();      // Assumes Name is in the third column
    var roll = sheet.getRange(lastRow, 4).getValue();      // Assumes Roll no is in the fourth column
    var pref = sheet.getRange(lastRow, 8).getValue();      // Assumes food pref is in the eighth column

    // Generate QR Code URL
    var qrCodeUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(uniqueID);

    
    // Mail body
    var mail_body = `

    bo                    
    
    `;
//Write the body of your mail in place of 'bo' in standard JavaScript format
    if (pref == "No food") {                // You can change the "No food" as per your convenience, also you can remove this if-else part altogether if not needed.
      return; // Exit the function, no email will be sent and no sheets will be updated.
    }
    // If the user selected a food option, proceed with the following actions.
    else{
      
      // --- Update the 'Scan' sheet for attendance ---
      var scansheet = ss.getSheetByName('Scan');
      // In the 'Scan' sheet, set the unique ID in the first column of the corresponding row.
      scansheet.getRange(lastRow, 1).setValue(uniqueID);
      // Set the food preference in the third column.
      scansheet.getRange(lastRow, 3).setValue(pref);
      // Set the initial scan status to 'no' in the second column. This will be updated to 'yes' when the QR is scanned.
      scansheet.getRange(lastRow, 2).setValue('no');

      // --- Update segregation sheets based on batch ---
      // Get the sheet named after the respondent's batch (e.g., a sheet named "MS22").
      var segsheet = ss.getSheetByName(batch);
      // Check if a sheet for this batch already exists.
      if (!segsheet) {
          // If it doesn't exist, create a new sheet with the batch name.
          segsheet = ss.insertSheet(batch);
          // Get the header row from the main 'Form Responses 1' sheet.
          var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
          // Copy these headers to the newly created batch sheet.
          segsheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
      }

      // Copy the entire new row of data from the 'Form Responses 1' sheet.
      var rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues();
      // Append this row to the end of the corresponding batch sheet.
      segsheet.appendRow(rowData[0]);

      // Send Email
      MailApp.sendEmail({
          to: email,
          subject: "",            //Add your subject in between the quotes
          htmlBody: mail_body
      });
    
    }
    
}
