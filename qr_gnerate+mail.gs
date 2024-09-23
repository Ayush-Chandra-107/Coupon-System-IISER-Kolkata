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

    bo                    //Write the body of your mail in place of 'bo' in standard JavaScript format
    
    `;

    if (pref == "No food") {                // You can change the "No food" as per your convenience, also you can remove this if-else part altogether if not needed.
      return;
    }
    else{
      // Send Email
      MailApp.sendEmail({
          to: email,
          subject: "",            //Add your subject in between the quotes
          htmlBody: mail_body
      });
    

      // Update the 'Scan' sheet
      var scansheet = ss.getSheetByName('Scan');
      scansheet.getRange(lastRow, 1).setValue(uniqueID);
      scansheet.getRange(lastRow, 2).setValue('no');
    }
    
}
