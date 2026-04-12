/**
 * Lipa Chat Widget
 *
 * A floating chat button + form that lives on every page.
 * Messages are stored in Supabase `chat_messages` table.
 * A Supabase Edge Function forwards them to Telegram.
 *
 * Drop this script at the bottom of any HTML page:
 *   <script src="/chat-widget.js"></script>
 */

(function() {
  // Config
  var SUPABASE_URL = 'https://ovprbhjtwtthuldcdlgq.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cHJiaGp0d3R0aHVsZGNkbGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTEzMTgsImV4cCI6MjA5MTA2NzMxOH0.n3clDryaCjEfGebFzk2ZiEacKd5xpVAXNUUGWPjklOA';

  // Inject CSS
  var style = document.createElement('style');
  style.textContent = `
    .lipa-chat-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 56px;
      height: 56px;
      background: #1B6B4A;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(27,107,74,0.35);
      z-index: 9999;
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
    }
    .lipa-chat-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(27,107,74,0.45);
    }
    .lipa-chat-btn svg { width: 24px; height: 24px; }
    .lipa-chat-panel {
      position: fixed;
      bottom: 96px;
      right: 28px;
      width: 360px;
      max-height: 480px;
      background: #FFFFFF;
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.15);
      z-index: 9998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Inter', -apple-system, sans-serif;
      border: 1px solid rgba(15,26,21,0.08);
    }
    .lipa-chat-panel.open { display: flex; }
    .lipa-chat-header {
      background: #1B6B4A;
      color: white;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .lipa-chat-header-title {
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .lipa-chat-header-sub {
      font-size: 11px;
      opacity: 0.75;
      margin-top: 2px;
    }
    .lipa-chat-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
      padding: 4px;
    }
    .lipa-chat-close:hover { opacity: 1; }
    .lipa-chat-body {
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    }
    .lipa-chat-body label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #8A928C;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .lipa-chat-body input,
    .lipa-chat-body textarea {
      width: 100%;
      border: 1px solid rgba(15,26,21,0.14);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 14px;
      font-family: inherit;
      color: #0F1A15;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
      resize: none;
    }
    .lipa-chat-body input:focus,
    .lipa-chat-body textarea:focus {
      border-color: #1B6B4A;
    }
    .lipa-chat-body input::placeholder,
    .lipa-chat-body textarea::placeholder {
      color: #8A928C;
    }
    .lipa-chat-body textarea { min-height: 80px; }
    .lipa-chat-send {
      width: 100%;
      background: #1B6B4A;
      color: white;
      border: none;
      border-radius: 980px;
      padding: 14px;
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s;
    }
    .lipa-chat-send:hover { background: #155A3D; }
    .lipa-chat-send:disabled { opacity: 0.6; cursor: not-allowed; }
    .lipa-chat-success {
      text-align: center;
      padding: 40px 24px;
    }
    .lipa-chat-success-icon {
      width: 48px;
      height: 48px;
      background: #E8F0EA;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .lipa-chat-success h3 {
      font-size: 16px;
      font-weight: 600;
      color: #0F1A15;
      margin-bottom: 8px;
    }
    .lipa-chat-success p {
      font-size: 13px;
      color: #5A635D;
      line-height: 1.5;
    }
    @media (max-width: 480px) {
      .lipa-chat-panel {
        width: calc(100vw - 32px);
        right: 16px;
        bottom: 88px;
      }
      .lipa-chat-btn {
        bottom: 20px;
        right: 20px;
      }
    }
  `;
  document.head.appendChild(style);

  // Create button
  var btn = document.createElement('button');
  btn.className = 'lipa-chat-btn';
  btn.setAttribute('aria-label', 'Chat with Lipa');
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  document.body.appendChild(btn);

  // Create panel
  var panel = document.createElement('div');
  panel.className = 'lipa-chat-panel';
  panel.innerHTML = `
    <div class="lipa-chat-header">
      <div>
        <div class="lipa-chat-header-title">Chat with Lipa</div>
        <div class="lipa-chat-header-sub">We usually reply within a few hours</div>
      </div>
      <button class="lipa-chat-close" aria-label="Close chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="lipa-chat-body" id="lipa-chat-form-area">
      <label>Name</label>
      <input type="text" id="lipa-chat-name" placeholder="Your name" />
      <label>Email</label>
      <input type="email" id="lipa-chat-email" placeholder="your@email.com" />
      <label>Message</label>
      <textarea id="lipa-chat-msg" placeholder="How can we help?"></textarea>
      <button class="lipa-chat-send" id="lipa-chat-submit">Send message</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Toggle
  var isOpen = false;
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
  });
  panel.querySelector('.lipa-chat-close').addEventListener('click', function() {
    isOpen = false;
    panel.classList.remove('open');
  });

  // Submit
  var submitBtn = document.getElementById('lipa-chat-submit');
  submitBtn.addEventListener('click', async function() {
    var name = document.getElementById('lipa-chat-name').value.trim();
    var email = document.getElementById('lipa-chat-email').value.trim();
    var msg = document.getElementById('lipa-chat-msg').value.trim();

    if (!msg) return;

    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/chat_messages', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          name: name || 'Anonymous',
          email: email || null,
          message: msg,
          page: window.location.pathname,
          source: 'chat_widget'
        })
      });

      if (res.ok || res.status === 201) {
        document.getElementById('lipa-chat-form-area').innerHTML = `
          <div class="lipa-chat-success">
            <div class="lipa-chat-success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3>Message sent</h3>
            <p>We'll get back to you as soon as we can. If you left your email, we'll reply there.</p>
          </div>
        `;
      } else {
        throw new Error('Failed');
      }
    } catch (err) {
      submitBtn.textContent = 'Send message';
      submitBtn.disabled = false;
      alert('Something went wrong. Please try again.');
    }
  });
})();
