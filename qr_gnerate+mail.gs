// Contact ac22ms107@iiserkol.ac.in for any assistance regarding this code
function onFormSubmit(e) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Form Responses 1');
    var lastRow = sheet.getLastRow();
    //var lastRow = 185;            //This line is for sending mails manually, in case of any error
  
    var email = sheet.getRange(lastRow, 5).getValue();  // Assumes Email is in the fifth column
    var uniqueID = sheet.getRange(lastRow, 7).getValue();  // Assumes Unique ID is in the seventh column
    var recipientName = sheet.getRange(lastRow, 3).getValue();  // Assumes Name is in the third column
    var roll = sheet.getRange(lastRow, 4).getValue();  // Assumes Roll no is in the fourth column
    var pref = sheet.getRange(lastRow, 8).getValue();  // Assumes food pref is in the eighth column

    // Generate QR Code URL
    var qrCodeUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(uniqueID);

    //Agomoni image url
    var agomoni_img_url = "https://ci3.googleusercontent.com/mail-sig/AIorK4zvC38JF4FR4Hfm8xObz3MYU0fujfOfNC__sfkAWB94ed9U1Pphsio5SHgPvCq8PU1j9YvWqwqu7rwL";

    //Durga image url
    var durga_image_url = "https://drive.google.com/uc?export=view&id=12ExO-xZAKNpdZzJ4YfXIcuSnlHgHoSe8";

    
    // Mail body
    var mail_body = `
        <p style="text-align: center;"><img src="${durga_image_url}" style="width:304px; height:425.6px;"></p>
        <p>Namaskar ${recipientName},</p>
        <p>Congratulations on securing your coupon for the <strong>Agomoni-r Mahabhoj</strong> lunch on <strong>September 13th!</strong> We're delighted that you'll be joining us for this special event.</p>
        <p>We can't wait to treat you to an exquisite spread of Bengali delicacies that are sure to ignite all your taste buds. The thali will feature a unique combination of bitter, spicy, tangy, and sweet flavors—a complete culinary experience that reflects the heart of Bengal.</p>
        <p><strong>Please note that this coupon allows entry for only one person. Don't forget to bring it along on the day of the event.</strong></p>
        <p>We look forward to sharing this delightful meal with you and making it a memorable experience.</p>
        <br>
        <p style="text-align: center;">Here is your QR code for the unique ID: <strong>${roll}</strong></p>
        <p style="text-align: center;"><img src="${qrCodeUrl}" style="width:200px; height:200px;"></p>
        <br>
        <p>--</p>
        <table>
            <tr style="vertical-align: baseline;">
                <td><img src="${agomoni_img_url}" style="width:100px; height:100px;"></td>
                <td style="padding-left: 10px;"><p><strong>Team Agomoni 2024</strong></p></td>
            </tr>
        </table>
        <p>Follow us at - 
        <a href='https://www.facebook.com/agomoni2023iiserK?mibextid=V3Yony'>Facebook</a><br>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href='https://instagram.com/agomoni_iiserkol?igshid=YmMyMTA2M2Y='>Instagram</a></p>
    `;

    if (pref == "No food (if donates below 191)") {
      return;
    }
    else{
      // Send Email
      MailApp.sendEmail({
          to: email,
          subject: "Agomoni Mahabhoj Coupon and Event Details",
          htmlBody: mail_body
      });
    

      // Update the 'Scan' sheet
      var scansheet = ss.getSheetByName('Scan');
      scansheet.getRange(lastRow, 1).setValue(uniqueID);
      scansheet.getRange(lastRow, 2).setValue('no');
    }
    
}
