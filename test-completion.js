// test-completion.js
async function testCompletion() {
    try {
        console.log('Testing completion API...');
        
        const response = await fetch('http://127.0.0.1:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: `### Instruction:
Write a short Python example that demonstrates list comprehension to create a list of squares of even numbers from 0 to 10.

### Response:`,
                n_predict: 200,
                temperature: 0.7,
                stop: ["###"],  // Stop at next section
                stream: false    // Get complete response
            })
        });

        if (!response.ok) {
            throw new Error(`Completion API failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('\nCompletion result:', JSON.stringify(result, null, 2));
        
        // Extract and display just the generated content for easier reading
        console.log('\nGenerated content:', result.content);
        
        return result;
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
testCompletion();