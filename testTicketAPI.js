// Test script để xem API response thực tế

// PASTE TOKEN MỚI VÀO ĐÂY (từ Chrome DevTools > Network > authorization header)
const AUTH_TOKEN = "PASTE_TOKEN_MOI_VAO_DAY";

const query = `query FindTicketPaginate($payload: TicketQuery) {
  findTicketPaginate(payload: $payload) {
    data {
      id
      ticketCode
      title
      description
      priority
      feedbackTopic
      status
      deadline
      customerId
      productUserId
      assignee {
        id
        username
        email
      }
      ticketSource {
        id
        channel
        noteId
        classId
        callId
        surveyResponseId
        studentName
        studentId
        className
        centreId
        surveyId
        questions {
          id
          title
          description
          options
          type
          isRequired
          group
        }
        answers {
          questionId
          value
        }
        centre {
          id
          shortName
        }
      }
      attachments {
        fileName
        fileUrl
      }
      comments {
        id
        message
        userId
        createdAt
        user {
          id
          username
          email
        }
      }
      createdAt
      closedDate
    }
    pagination {
      type
      total
    }
  }
}`;

const variables = {
  payload: {
    pageIndex: 0,
    itemsPerPage: 2, // Chỉ lấy 2 tickets để test
    assignee_in: [],
    centreId_in: [
      "62d6dc936e356729147d7399",
      "62b0234675379306da49f051",
      "609bf4149535070ca5e3edc0",
      "63034f877d1d1e1cb14e4e5f",
      "62918d02af37d11e2da237e5",
      "62d6dcc16e356729147d73a6",
      "63034f4a7d1d1e1cb14e4e57",
      "62cc07753c1309654f472e60"
    ],
    feedbackTopic_in: [],
    status_in: [],
    channel_in: [],
    filter_textSearch: "",
    deadline_gte: "",
    deadline_lte: "",
    createdAt_gte: "",
    createdAt_lte: ""
  }
};

async function testAPI() {
  try {
    console.log('🧪 TEST API - Lấy 2 tickets đầu tiên...\n');
    
    const response = await fetch('https://lms-api.mindx.vn/', {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authorization': AUTH_TOKEN,
        'content-type': 'application/json',
        'content-language': 'vi',
        'origin': 'https://lms.mindx.edu.vn'
      },
      body: JSON.stringify({
        operationName: 'FindTicketPaginate',
        variables: variables,
        query: query
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ GraphQL Errors:');
      console.error(JSON.stringify(result.errors, null, 2));
      return;
    }

    const tickets = result.data?.findTicketPaginate?.data || [];
    console.log(`✅ Lấy được ${tickets.length} tickets\n`);
    
    if (tickets.length > 0) {
      console.log('📋 TICKET ĐẦU TIÊN (FULL DATA):');
      console.log('='.repeat(80));
      console.log(JSON.stringify(tickets[0], null, 2));
      console.log('='.repeat(80));
      
      console.log('\n🔍 KIỂM TRA CÁC FIELD THỜI GIAN:');
      console.log('  ticketCode:', tickets[0].ticketCode);
      console.log('  createdAt:', tickets[0].createdAt);
      console.log('  closedDate:', tickets[0].closedDate);
      console.log('  deadline:', tickets[0].deadline);
      console.log('  createdAt type:', typeof tickets[0].createdAt);
      console.log('  closedDate type:', typeof tickets[0].closedDate);
      console.log('  deadline type:', typeof tickets[0].deadline);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testAPI();
