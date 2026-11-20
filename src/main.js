
import './style.css'
import emailjs from '@emailjs/browser'
import { auth, db } from './firebase'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {
  doc,
  onSnapshot,
  runTransaction
} from 'firebase/firestore'

// ACCOUNT INFORMATION
const USERS = {
  'KrxF8sxPLJW67JcKvzXPxYA9QUA3': 'V',
  'lKv6nEIk3Fc2CiKqiomhSpwzxnb2': 'Z'
}

const USER_EMAILS = {
  Z: 'zvbebubebu@gmail.com',
  V: 'vlycme@gmail.com'
}

// EMAILJS SETTINGS
const EMAILJS_SERVICE_ID = 'service_t5hkqeo'
const EMAILJS_TEMPLATE_ID = 'template_tupep5s'
const EMAILJS_PUBLIC_KEY = 'mHedCPfX8jds2yhPD'

const roomRef = doc(db, 'hugRoom', 'main')

document.querySelector('#app').innerHTML = `
  <main class="hug-page">
    <div class="floating-hearts">💕　💗　💕　💗</div>

    <section class="hug-card">
      <div id="loginSection">
        <p class="top-label">♡ OUR LITTLE LOVE SPACE ♡</p>
        <h1>Our Little Hug Machine</h1>
        <p class="subtitle">Login to send your bebu a hug ♡</p>
        <div class="login-bears">🧸 💗 🧸</div>

        <form id="loginForm">
          <input id="emailInput" type="email"
            placeholder="Email address" required />
          <input id="passwordInput" type="password"
            placeholder="Password" required />
          <button class="hug-button" type="submit">
            💕 Login to Our Love Space
          </button>
        </form>

        <p id="loginMessage" class="login-message"></p>
      </div>

      <div id="hugSection" hidden>
        <p class="top-label">♡ OUR LITTLE LOVE SPACE ♡</p>
        <h1>Our Little Hug Machine</h1>
        <p class="subtitle">A little hug whenever you miss me ♡</p>

        <div class="account-bar">
          <span id="accountLabel">Logged in</span>
          <button id="logoutButton" class="logout-button">Logout</button>
        </div>

        <div class="bear-scene" id="bearScene">
          <div class="bear bear-left">
            🧸
            <span class="bear-name">Z</span>
          </div>
          <div class="bear bear-right">
            🧸
            <span class="bear-name">V</span>
          </div>
          <div class="hug-heart">💗</div>
          <div class="sparkle sparkle-one">✨</div>
          <div class="sparkle sparkle-two">💕</div>
        </div>

        <div class="status-box">
          <p id="statusTitle">Missing your bebu?</p>
          <p id="statusText">What kind of hug do you need today?</p>
          <div id="countdown" class="countdown">♡</div>
          <p id="timerLabel">Choose your little hug 💗</p>
        </div>

        <div id="choiceButtons" class="choice-buttons">
          <button id="sendHugButton" class="hug-button">
            🫂 Send a Hug
          </button>
          <button id="requestHugButton" class="request-button">
            🥺 Request a Hug
          </button>
        </div>

        <button id="hugBackButton" class="secondary-button" disabled>
          💕 Hug Back!
        </button>

        <p id="hugMessage" class="hug-message">
          A hug is always waiting for you. ❤️
        </p>

        <div class="stats">
          <div class="stat">
            <span class="stat-number" id="hugCount">0</span>
            <span class="stat-label">Hugs sent 🫂</span>
          </div>
          <div class="stat">
            <span class="stat-number" id="backCount">0</span>
            <span class="stat-label">Hugs returned 💕</span>
          </div>
        </div>

        <section class="history-section">
          <h2>Our Hug Memories 📜</h2>
          <div id="hugHistory">
            <p class="empty-history">Our first hug is waiting here! ♡</p>
          </div>
        </section>

        <p class="footer">
          A hug can wait, but love never forgets. 🧸💕
        </p>
      </div>
    </section>
  </main>
`

const $ = id => document.getElementById(id)

const loginSection = $('loginSection')
const hugSection = $('hugSection')
const loginForm = $('loginForm')
const loginMessage = $('loginMessage')
const logoutButton = $('logoutButton')

const sendHugButton = $('sendHugButton')
const requestHugButton = $('requestHugButton')
const hugBackButton = $('hugBackButton')
const bearScene = $('bearScene')

const statusTitle = $('statusTitle')
const statusText = $('statusText')
const countdown = $('countdown')
const timerLabel = $('timerLabel')
const hugMessage = $('hugMessage')
const hugCount = $('hugCount')
const backCount = $('backCount')
const hugHistory = $('hugHistory')

let currentUser = null
let myRole = null
let unsubscribeRoom = null
let timer = null
let activeHug = null
let stats = { sent: 0, returned: 0 }
let history = []
let firstSnapshot = true
let lastHandledStatus = ''
let terminalTimer = null
let lastWaitingId = ''

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char])
}

function getSenderSide(hug) {
  return USERS[hug.fromUid] === 'Z' ? 'left' : 'right'
}

// EMAIL NOTIFICATION
async function sendHugEmail(mode, receiverRole) {
  const receiverEmail = USER_EMAILS[receiverRole]

  const templateParams = {
    to_email: receiverEmail,
    to_name: receiverRole,
    from_name: myRole,
    subject: mode === 'send'
      ? `${myRole} sent you a hug! 🧸`
      : `${myRole} is requesting a hug! 🥺`,
    message: mode === 'send'
      ? `${myRole} just sent you a warm hug! Open Our Little Hug Machine and hug back! 💕`
      : `${myRole} is missing you and requesting a hug! Open Our Little Hug Machine and send a hug back! 💗`
  }

  try {
    await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    )

    console.log('Hug notification email sent!')
    return true
  } catch (error) {
    console.error('Email notification failed:', error)
    return false
  }
}

function animateHug(type, senderSide = '') {
  bearScene.classList.remove(
    'waiting',
    'hugging',
    'solo-hug',
    'sender-left',
    'sender-right'
  )

  void bearScene.offsetWidth
  bearScene.classList.add(type)

  if (senderSide) {
    bearScene.classList.add(`sender-${senderSide}`)
  }
}

function stopTimer() {
  clearInterval(timer)
  timer = null
}

function updateButtons() {
  const waiting = activeHug?.status === 'waiting'
  const amReceiver = waiting && activeHug.toUid === currentUser?.uid

  sendHugButton.disabled = Boolean(waiting)
  requestHugButton.disabled = Boolean(waiting)
  hugBackButton.disabled = !amReceiver
}

function resetDisplay() {
  stopTimer()
  clearTimeout(terminalTimer)

  bearScene.classList.remove(
    'waiting',
    'hugging',
    'solo-hug',
    'sender-left',
    'sender-right'
  )

  statusTitle.textContent = 'Missing your bebu?'
  statusText.textContent = 'What kind of hug do you need today?'
  countdown.textContent = '♡'
  timerLabel.textContent = 'Choose your little hug 💗'
  hugMessage.textContent = 'A hug is always waiting for you. ❤️'

  updateButtons()
}

function render() {
  hugCount.textContent = stats.sent || 0
  backCount.textContent = stats.returned || 0

  hugHistory.innerHTML = history.length
    ? history.map(item => `
      <div class="history-item">
        <span>🫂</span>
        <div>
          <strong>${escapeHTML(item.message)}</strong>
          <small>${escapeHTML(item.date)}</small>
        </div>
        <span>💗</span>
      </div>
    `).join('')
    : '<p class="empty-history">Our first hug is waiting here! ♡</p>'
}

function showResult(type) {
  stopTimer()
  updateButtons()

  sendHugButton.disabled = true
  requestHugButton.disabled = true
  hugBackButton.disabled = true

  if (type === 'returned') {
    animateHug('hugging')
    statusTitle.textContent = 'A hug from both of you! 💕'
    statusText.textContent = 'Your bebus hugged each other!'
    countdown.textContent = '💗'
    timerLabel.textContent = 'A perfect little moment.'
    hugMessage.textContent = 'You hugged each other. Sending more love! 🧸❤️'
  } else {
    animateHug('solo-hug', getSenderSide(activeHug))
    statusTitle.textContent = 'A hug is on its way! 🧸'
    statusText.textContent = 'Your bebu may be busy, but love is still here.'
    countdown.textContent = '💗'
    timerLabel.textContent = 'No pressure, just love.'
    hugMessage.textContent = 'A warm hug was sent anyway. Take your time, bebu! ❤️'
  }

  clearTimeout(terminalTimer)
  terminalTimer = setTimeout(() => {
    resetDisplay()
  }, 4000)
}

function showWaitingState() {
  if (!activeHug || activeHug.status !== 'waiting') return

  updateButtons()

  const senderSide = getSenderSide(activeHug)
  animateHug('waiting', senderSide)

  const isReceiver = activeHug.toUid === currentUser.uid

  if (activeHug.mode === 'request') {
    if (isReceiver) {
      statusTitle.textContent = `${activeHug.fromName} is requesting a hug! 🥺`
      statusText.textContent = 'Your bebu needs a little hug.'
      timerLabel.textContent = 'You have 10 seconds to respond!'
    } else {
      statusTitle.textContent = 'You requested a hug! 💗'
      statusText.textContent = `Waiting for ${activeHug.toName} to hug you.`
      timerLabel.textContent = 'Your bebu has 10 seconds to respond.'
    }
  } else {
    if (isReceiver) {
      statusTitle.textContent = `${activeHug.fromName} sent you a hug! 💗`
      statusText.textContent = 'Your bebu is sending you a hug.'
      timerLabel.textContent = 'You have 10 seconds to hug back!'
    } else {
      statusTitle.textContent = 'Waiting for your bebu... 💕'
      statusText.textContent = 'Your hug is on its way!'
      timerLabel.textContent = 'Your bebu has 10 seconds to reply.'
    }
  }

  if (lastWaitingId !== activeHug.id) {
    lastWaitingId = activeHug.id
  }

  startCountdown()
}

function startCountdown() {
  stopTimer()

  function tick() {
    if (!activeHug || activeHug.status !== 'waiting') {
      stopTimer()
      return
    }

    const remaining = Math.max(
      0,
      Math.ceil((activeHug.expiresAt - Date.now()) / 1000)
    )

    countdown.textContent = `00:${String(remaining).padStart(2, '0')}`

    if (remaining <= 0) {
      stopTimer()
      finishSolo(activeHug.id)
    }
  }

  tick()
  timer = setInterval(tick, 250)
}

async function createHug(mode) {
  if (!currentUser || activeHug?.status === 'waiting') return

  const receiverUid = Object.keys(USERS).find(
    uid => uid !== currentUser.uid
  )

  if (!receiverUid) return

  const receiverRole = USERS[receiverUid]
  const hugId = crypto.randomUUID()
  const now = Date.now()

  sendHugButton.disabled = true
  requestHugButton.disabled = true

  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef)
      const data = snapshot.exists() ? snapshot.data() : {}

      if (data.activeHug?.status === 'waiting') {
        throw new Error('May kasalukuyang hug request. Hintayin muna itong matapos.')
      }

      const oldStats = data.stats || { sent: 0, returned: 0 }

      transaction.set(roomRef, {
        activeHug: {
          id: hugId,
          mode,
          fromUid: currentUser.uid,
          fromName: myRole,
          toUid: receiverUid,
          toName: receiverRole,
          status: 'waiting',
          createdAt: now,
          expiresAt: now + 10000
        },
        stats: {
          sent: (oldStats.sent || 0) + (mode === 'send' ? 1 : 0),
          returned: oldStats.returned || 0
        }
      }, { merge: true })
    })

    hugMessage.textContent = mode === 'send'
      ? `You sent a hug to ${receiverRole}! 💕`
      : `You requested a hug from ${receiverRole}! 🥺`

    // Email the other person after Firebase saves the hug.
    await sendHugEmail(mode, receiverRole)

  } catch (error) {
    alert(error.message || 'Hindi naipadala ang request. Subukan ulit.')
    updateButtons()
  }
}

async function finishTogether() {
  if (!activeHug || activeHug.status !== 'waiting') return
  if (activeHug.toUid !== currentUser.uid) return

  const hugId = activeHug.id

  hugBackButton.disabled = true

  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef)
      if (!snapshot.exists()) return

      const data = snapshot.data()
      const hug = data.activeHug

      if (!hug || hug.id !== hugId || hug.status !== 'waiting') return
      if (hug.toUid !== currentUser.uid) return

      const oldStats = data.stats || { sent: 0, returned: 0 }
      const oldHistory = data.history || []

      transaction.update(roomRef, {
        'activeHug.status': 'returned',
        stats: {
          sent: oldStats.sent || 0,
          returned: (oldStats.returned || 0) + 1
        },
        history: [{
          message: `${hug.fromName} and ${hug.toName} shared a warm hug!`,
          date: new Date().toLocaleString()
        }, ...oldHistory].slice(0, 10)
      })
    })
  } catch (error) {
    alert('Hindi naibalik ang hug. Pakisubukan ulit.')
    updateButtons()
  }
}

async function finishSolo(hugId) {
  if (!currentUser) return

  try {
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef)
      if (!snapshot.exists()) return

      const data = snapshot.data()
      const hug = data.activeHug

      if (!hug || hug.id !== hugId || hug.status !== 'waiting') return
      if (Date.now() < hug.expiresAt) return

      const oldHistory = data.history || []

      transaction.update(roomRef, {
        'activeHug.status': 'solo',
        history: [{
          message: hug.mode === 'request'
            ? `${hug.fromName} requested a hug from ${hug.toName}.`
            : `${hug.fromName} sent a warm hug anyway!`,
          date: new Date().toLocaleString()
        }, ...oldHistory].slice(0, 10)
      })
    })
  } catch (error) {
    console.error('Could not finish hug:', error)
  }
}

function listenToRoom() {
  if (unsubscribeRoom) unsubscribeRoom()

  firstSnapshot = true
  lastHandledStatus = ''

  unsubscribeRoom = onSnapshot(roomRef, snapshot => {
    const data = snapshot.exists() ? snapshot.data() : {}

    activeHug = data.activeHug || null
    stats = data.stats || { sent: 0, returned: 0 }
    history = data.history || []

    render()

    if (firstSnapshot) {
      firstSnapshot = false

      if (activeHug?.status === 'waiting') {
        showWaitingState()
      } else {
        resetDisplay()
      }
      return
    }

    if (activeHug?.status === 'waiting') {
      showWaitingState()
      return
    }

    stopTimer()

    if (activeHug && ['returned', 'solo'].includes(activeHug.status)) {
      const statusKey = `${activeHug.id}:${activeHug.status}`

      if (statusKey !== lastHandledStatus) {
        lastHandledStatus = statusKey
        showResult(activeHug.status)
      }
    } else {
      resetDisplay()
    }
  }, error => {
    console.error(error)
    statusText.textContent = 'Connection problem. Please refresh the page.'
  })
}

// LOGIN
loginForm.addEventListener('submit', async event => {
  event.preventDefault()

  const email = $('emailInput').value.trim()
  const password = $('passwordInput').value

  loginMessage.textContent = 'Logging in...'

  try {
    await signInWithEmailAndPassword(auth, email, password)
    loginMessage.textContent = ''
    loginForm.reset()
  } catch (error) {
    loginMessage.textContent = 'Login failed. Check your email and password.'
  }
})

// LOGOUT
logoutButton.addEventListener('click', async () => {
  stopTimer()

  if (unsubscribeRoom) {
    unsubscribeRoom()
    unsubscribeRoom = null
  }

  await signOut(auth)
})

// BUTTONS
sendHugButton.addEventListener('click', () => createHug('send'))
requestHugButton.addEventListener('click', () => createHug('request'))
hugBackButton.addEventListener('click', finishTogether)

// AUTHENTICATION
onAuthStateChanged(auth, user => {
  currentUser = user

  if (!user) {
    myRole = null
    stopTimer()

    if (unsubscribeRoom) {
      unsubscribeRoom()
      unsubscribeRoom = null
    }

    loginSection.hidden = false
    hugSection.hidden = true
    return
  }

  myRole = USERS[user.uid]

  if (!myRole) {
    signOut(auth)
    loginMessage.textContent = 'This account is not authorized.'
    return
  }

  loginSection.hidden = true
  hugSection.hidden = false
  $('accountLabel').textContent = `Logged in as ${myRole} 🧸`

  listenToRoom()
})
