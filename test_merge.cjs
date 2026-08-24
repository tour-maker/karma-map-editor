const sheetMatch = { remarks: 'this is the final test yes' };
const localRemarks = 'this is the final test';

const remarksChanged = sheetMatch.remarks && sheetMatch.remarks !== localRemarks;

if (remarksChanged) {
  console.log('REMARKS CHANGED! New remarks:', sheetMatch.remarks || localRemarks);
} else {
  console.log('REMARKS DID NOT CHANGE');
}
