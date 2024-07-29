function extractOCR() {
    var folderIterator = DriveApp.getFoldersByName('_fish_');
    if (!folderIterator.hasNext()) {
      throw new Error("Folder '_fish_' not found");
    }

    var workingDir = folderIterator.next();
    var files = workingDir.getFiles();

    while (files.hasNext()) {
      var file = files.next();
      var imageName = file.getName();
      var docName = imageName.split(".")[0];

      var resource = {
        title: docName,
        mimeType: file.getMimeType()
      };

      var ocrFile = Drive.Files.insert(resource, file.getBlob(), { ocr: true });

      // Store newly-created Google Doc in project folder
      var newFile = DriveApp.getFileById(ocrFile.id);
      workingDir.addFile(newFile);
      DriveApp.getRootFolder().removeFile(newFile);
    }

    // Find all Google Docs in folder
    var docs = workingDir.getFilesByType("application/vnd.google-apps.document");

    // Set up spreadsheet
    var spreadsheets = DriveApp.getFilesByName('Purchase Records');
    var ss;
    var sheet;

    if (spreadsheets.hasNext()) {
      ss = SpreadsheetApp.open(spreadsheets.next());
    } else {
      ss = SpreadsheetApp.create("Purchase Records");
      sheet = ss.getActiveSheet();
      // Initialize columns
      sheet.appendRow(["Date", "Item", "Qty", "Price"]);
    }

    // Ensure we're working with the correct sheet
    SpreadsheetApp.setActiveSpreadsheet(ss);
    sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Check if headers exist and add them if not
    if (sheet.getLastRow() == 0) {
      sheet.appendRow(["Date", "Item", "Qty", "Price"]);
    }

    // Populate spreadsheet with OCR text
    while (docs.hasNext()) {
      var file = docs.next();
      var docId = file.getId();
      var doc = DocumentApp.openById(docId);
      var body = doc.getBody().getText();

      // Extract required fields from the OCR text
      var date = extractDate(body);
      var items = extractItems(body);

      items.forEach(function(item) {
        // Add item data to spreadsheet
        sheet.appendRow([date, item.description, item.qty, item.price]);
      });

      // Permanently delete the Google Doc
      Drive.Files.remove(docId);
    }

    // Format the "Price" column as currency
    var range = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1);
    range.setNumberFormat("RM#,##0.00");
}

// Helper function to extract the date from OCR text
function extractDate(text) {
  var dateRegex = /Date:\s*(\d{4}-\d{2}-\d{2})/;
  var match = text.match(dateRegex);
  return match ? match[1] : "";
}

// Helper function to extract items from OCR text
function extractItems(text) {
  var items = [];
  var itemRegex = /(\d+)\s+([^\n]+)\nRM([\d.]+)\s+RM([\d.]+)/g;
  var match;

  while (match = itemRegex.exec(text)) {
    items.push({
      qty: match[1],
      description: match[2].trim(),
      price: match[4]  // Use the total amount instead of unit price
    });
  }

  return items;
}
