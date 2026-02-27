const PROXY = 'https://script.google.com/macros/s/AKfycbxRpQqnHy36mOBXjtOf6hSMzOYjAzPskfJcsogSjcyCSYd0RV93Q8PFIRvoAwzWNdz4/exec';

const query = `query GetClasses($pageIndex: Int!, $itemsPerPage: Int!, $statusIn: [String]) {
  classes(payload: { status_in: $statusIn, pageIndex: $pageIndex, itemsPerPage: $itemsPerPage }) {
    data { id name }
    pagination { total }
  }
}`;

fetch(PROXY, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    operationName: 'GetClasses',
    query,
    variables: { pageIndex: 0, itemsPerPage: 3, statusIn: ['RUNNING'] }
  })
})
  .then(r => r.json())
  .then(d => {
    if (d.error) {
      console.log('❌ ERROR:', d.error, '| status:', d.status);
    } else {
      const classes = d.data?.classes;
      console.log('✅ OK! Total lớp:', classes?.pagination?.total);
      console.log('   Sample:', classes?.data?.map(c => c.name).join(', '));
    }
  })
  .catch(e => console.log('❌ Network ERR:', e.message));
