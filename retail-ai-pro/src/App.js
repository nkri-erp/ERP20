import React, { useState, useEffect } from 'react';
import { Upload, Table, MessageSquare, AlertCircle, CheckCircle, Loader,Send } from 'lucide-react';
//import { Amplify, Storage } from 'aws-amplify';
import { Amplify } from 'aws-amplify';
import { uploadData } from 'aws-amplify/storage'; // New v6 way


// --- CONFIGURATION ---
const API_URL = "YOUR_API_GATEWAY_URL/vouchers"; // From API Gateway Console
const CHAT_API_URL = "YOUR_API_GATEWAY_URL/chat";
const BUCKET_NAME = "bucketname";

Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: '', // Paste the ID here
      allowGuestAccess: true
    }
  },
  Storage: {
    S3: {
      bucket: BUCKET_NAME,
      region: 'region' //region
    }
  }
});



function App() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // AI Chat States
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Hello! I am your RetailAI Assistant. Ask me about your invoices or GST liability.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // 1. FETCH DATA FROM DYNAMODB (VIA API GATEWAY)
  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      // Filter only SUMMARY records for the main ledger
      const summaries = data.filter(item => item.record_type === 'SUMMARY');
      setVouchers(summaries);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  // 2. UPLOAD TO S3 (TRIGGERS LAMBDA AUTOMATICALLY)
  const handleFileUpload = async (e) => {
  const file = e.target.files[0]; // Get the first file
  if (!file) return;

  setUploading(true);
  try {
    // In v6, uploadData returns an operation object with a .result promise
    const result = await uploadData({
    path: `${file.name}`, // Explicitly add 'public/' prefix
    data: file,
    options: {
      contentType: file.type
    }
  }).result;


    alert("Upload Successful! Processing invoice...");
    setTimeout(fetchVouchers, 5000);
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed. Check console for details.");
  } finally {
    setUploading(false);
  }
};

// --- AI CHAT LOGIC ---
  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput("");
    setIsTyping(true);

    try {
      const res = await fetch(CHAT_API_URL, {
        method: 'POST',
        body: JSON.stringify({ prompt: chatInput }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, my brain is offline. Check API Gateway!" }]);
    } finally { setIsTyping(false); }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1>RetailAI Pro Dashboard</h1>
      
      {/* UPLOAD & LEDGER (Existing Code) */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ padding: '12px 24px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', cursor: 'pointer' }}>
          {uploading ? "Processing..." : "Upload Invoice"}
          <input type="file" hidden onChange={handleFileUpload} />
        </label>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
         <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                <th>ID</th><th>Vendor</th><th>Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v => (
                <tr key={v.voucher_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{v.voucher_id}</td><td>{v.vendor_name}</td><td>₹{v.total_amount}</td>
                  <td>{v.e_way_bill === 'REQUIRED' ? '🚨 Needed' : '✅ OK'}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>

      {/* --- AI ASSISTANT SECTION --- */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '350px', background: 'white', borderRadius: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MessageSquare size={20} /> <strong>AI Assistant</strong>
        </div>
        <div style={{ height: '250px', overflowY: 'auto', padding: '15px', backgroundColor: '#f9fafb' }}>
          {chatHistory.map((msg, i) => (
            <div key={i} style={{ marginBottom: '10px', textAlign: msg.role === 'ai' ? 'left' : 'right' }}>
              <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: '10px', backgroundColor: msg.role === 'ai' ? '#e5e7eb' : '#2563eb', color: msg.role === 'ai' ? 'black' : 'white', fontSize: '14px' }}>
                {msg.text}
              </span>
            </div>
          ))}
          {isTyping && <p style={{ fontSize: '12px', color: 'gray' }}>Claude is thinking...</p>}
        </div>
        <div style={{ padding: '10px', display: 'flex', gap: '5px', borderTop: '1px solid #eee' }}>
          <input 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleChat()}
            placeholder="Ask about your sales..." 
            style={{ flex: 1, border: 'none', outline: 'none' }} 
          />
          <button onClick={handleChat} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb' }}><Send size={20}/></button>
        </div>
      </div>
    </div>
  );
}

export default App;