var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheet = ss.getSheetByName('Scan');       // Scan is the name of the second spreadsheet

function doGet() {
  var tmpl = HtmlService.createTemplateFromFile('scanner');      //scanner is the name of 3rd file
  return tmpl.evaluate().setTitle('scanner');
}

function sendback(x) {            //Will be referred in scanner.html
  // Get all the data in the first column of second sheet (containing the UTR numbers)
  var data = sheet.getRange('A:A').getValues();
  var y = -1;

  // Loop through each row to find the matching value in the first column
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == x) {
      y = i + 1; // Set y to the row number (i is zero-indexed)
      break;
    }
  }

  // Check if a matching row was found
  if (y !== -1) {
    // If found, check and update the second column
    if (sheet.getRange(y, 2).getValue() == 'no') {
      sheet.getRange(y, 2).setValue('yes'); // Update to 'yes'
      return "ok";  // Success message
    } else {
      return "error";  // Error message if the value is already 'yes'
    }
  } else {
    // If no matching row was found, return "UTR not recognised" message
    return "UTR not recognised";
  }
}
