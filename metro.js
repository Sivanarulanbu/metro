const stationData = {
      'Central Station': { distance: 0 },
      'Business District': { distance: 3 },
      'University': { distance: 7 },
      'Airport': { distance: 15 },
      'Mall Plaza': { distance: 5 },
      'Sports Complex': { distance: 8 },
      'Tech Park': { distance: 12 },
      'City Center': { distance: 4 }
    };

    const trainSchedules = [
      { id: 'EXP001', name: 'Morning Express', baseTime: '06:30', duration: 25, status: 'on-time' },
      { id: 'RGL001', name: 'Regular Service', baseTime: '07:15', duration: 35, status: 'on-time' },
      { id: 'EXP002', name: 'Business Express', baseTime: '08:00', duration: 28, status: 'delayed', delay: 5 },
      { id: 'RGL002', name: 'City Connector', baseTime: '09:30', duration: 40, status: 'on-time' },
      { id: 'EXP003', name: 'Metro Rapid', baseTime: '11:00', duration: 22, status: 'on-time' },
      { id: 'RGL003', name: 'Afternoon Service', baseTime: '14:00', duration: 38, status: 'on-time' },
      { id: 'EXP004', name: 'Evening Express', baseTime: '17:30', duration: 25, status: 'on-time' },
      { id: 'RGL004', name: 'Night Service', baseTime: '20:00', duration: 35, status: 'on-time' }
    ];

    // ---------- STATE ----------
    let userBalance = 250.00;
    let bookedTickets = [];
    let totalTrips = 0;
    let moneySpent = 0;

    const booking = {
      from: '', to: '', date: '', type: 'standard', train: null, seats: [], passengers: [], pay: 'wallet'
    };

    // ---------- HELPERS ----------
    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));
    const fmt = n => `₹${n.toFixed(2)}`;

    function todayISO(){ const t = new Date(); t.setHours(0,0,0,0); return t.toISOString().split('T')[0]; }

    function setActiveScreen(name){
      $$('.screen').forEach(s=>s.classList.remove('active'));
      $(`#${name}-screen`).classList.add('active');
      $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===name));
    }

    function setSteps(active){
      [1,2,3,4].forEach(i=>{
        const el = $(`#st-${i}`);
        el.classList.remove('active','done');
        if(i < active) el.classList.add('done');
        if(i === active) el.classList.add('active');
      });
    }

    function timePlus(base, addMin){
      const [h,m] = base.split(':').map(Number);
      const d = new Date(); d.setHours(h); d.setMinutes(m + addMin);
      const hh = String(d.getHours()).padStart(2,'0');
      const mm = String(d.getMinutes()).padStart(2,'0');
      return `${hh}:${mm}`;
    }

    function distanceFare(a,b){
      if(!a || !b) return 0;
      const km = Math.abs(stationData[a].distance - stationData[b].distance) || 1;
      // Base: ₹10 + ₹3/km (caps simple)
      return 10 + km * 3;
    }

    function renderSchedule(){
      const box = $('#schedule'); box.innerHTML = '';
      trainSchedules.forEach(tr => {
        const delay = tr.status==='delayed' ? (tr.delay||5) : 0;
        const start = timePlus(tr.baseTime, 0 + delay);
        const end = timePlus(tr.baseTime, tr.duration + delay);
        const li = document.createElement('div');
        li.className = 'sched';
        li.innerHTML = `
          <div class="left">
            <div class="time">${start} → ${end}</div>
            <div class="name">${tr.name} • ${tr.id}</div>
          </div>
          <div class="right">
            <div class="pill ${tr.status==='delayed'?'del':'on'}">${tr.status==='delayed'?'Delayed':'On time'}</div>
            <div class="dur">Duration: ${tr.duration + delay}m</div>
          </div>
        `;
        li.addEventListener('click',()=>{
          $$('.sched').forEach(x=>x.classList.remove('selected'));
          li.classList.add('selected');
          booking.train = { ...tr, start,end, duration: tr.duration + delay };
        });
        box.appendChild(li);
      });
    }

    function renderCoaches(){
      const c = $('#coaches'); c.innerHTML = '';
      const passengers = parseInt($('#passengers').value, 10);
      const want = passengers;
      const coaches = ['A1','A2','B1'];
      booking.seats = [];

      coaches.forEach(name => {
        const wrap = document.createElement('div');
        wrap.className = 'coach';
        wrap.innerHTML = `<div class="coach-head"><span>Coach ${name}</span><span class="avail">Seats available</span></div>`;
        const grid = document.createElement('div'); grid.className = 'grid';

        for(let i=1;i<=16;i++){
          const seatId = `${name}-${i}`;
          const seat = document.createElement('div'); seat.className = 'seat'; seat.textContent = i;
          // Randomly mark a few occupied for realism
          const occupied = Math.random() < 0.15;
          if(occupied) seat.classList.add('occupied');

          seat.addEventListener('click',()=>{
            if(seat.classList.contains('occupied')) return;
            if(seat.classList.contains('selected')){
              seat.classList.remove('selected');
              booking.seats = booking.seats.filter(s=>s!==seatId);
            } else {
              if(booking.seats.length >= want){
                alert(`You can select up to ${want} seat(s).`);
                return;
              }
              seat.classList.add('selected');
              booking.seats.push(seatId);
            }
            updateSummary();
          });

          grid.appendChild(seat);
        }
        wrap.appendChild(grid);
        c.appendChild(wrap);
      });
    }

    function renderPassengerForms(){
      const c = $('#pax-forms'); c.innerHTML = '';
      const passengers = parseInt($('#passengers').value, 10);
      booking.passengers = [];
      for(let i=1;i<=passengers;i++){
        const card = document.createElement('div'); card.className = 'card'; card.style.marginBottom='10px';
        card.innerHTML = `
          <div class="group"><strong style="color:#0ea5e9">Passenger ${i}</strong></div>
          <div class="group"><label>Full Name</label><input type="text" placeholder="Name" data-field="name" data-index="${i-1}"/></div>
          <div class="group"><label>Age</label><input type="text" placeholder="Age" data-field="age" data-index="${i-1}"/></div>
        `;
        c.appendChild(card);
      }
      // Collect inputs into booking.passengers on input
      c.addEventListener('input', (e)=>{
        const t = e.target; if(!t.dataset) return;
        const idx = parseInt(t.dataset.index,10);
        booking.passengers[idx] = booking.passengers[idx] || { name:'', age:'' };
        booking.passengers[idx][t.dataset.field] = t.value.trim();
      }, { once: true });
    }

    function updateSummary(){
      const base = distanceFare(booking.from, booking.to) * (parseInt($('#passengers').value,10) || 1);
      const premium = booking.type==='premium' ? base * 0.5 : 0;
      const total = base + premium + 10; // convenience fee

      $('#sum-route').textContent = `${booking.from || '-'} → ${booking.to || '-'}`;
      $('#sum-train').textContent = booking.train ? `${booking.train.name} • ${booking.train.start}` : '-';
      $('#sum-seats').textContent = booking.seats.length ? booking.seats.join(', ') : '-';
      $('#sum-base').textContent = fmt(base);
      $('#sum-prem').textContent = fmt(premium);
      $('#sum-total').textContent = fmt(total);

      $('#summary').style.display = 'block';
      return { base, premium, total };
    }

    function resetToStep(step){
      ['#step-1','#step-2','#step-3','#step-4'].forEach((id,i)=>{
        const el = document.querySelector(id);
        el.style.display = (i === step-1) ? 'block' : 'none';
      });
      setSteps(step);
    }

    function requireStep1(){
      if(!booking.from || !booking.to){ alert('Please choose From and To stations.'); return false; }
      if(booking.from === booking.to){ alert('From and To cannot be the same.'); return false; }
      if(!booking.date){ alert('Please select a journey date.'); return false; }
      return true;
    }

    function requireStep2(){ if(!booking.train){ alert('Please select a train schedule.'); return false; } return true; }
    function requireStep3(){ const need = parseInt($('#passengers').value,10); if(booking.seats.length !== need){ alert(`Please select ${need} seat(s).`); return false; } return true; }

    // ---------- TICKETS RENDER ----------
    function renderTickets(){
      const list = $('#tickets-list'); list.innerHTML = '';
      if(bookedTickets.length === 0){
        list.innerHTML = `<div class="empty"><div class="big">🎫</div><h3>No Tickets Yet</h3><p>Book your first metro ticket to get started.</p></div>`;
        return;
      }
      bookedTickets.slice().reverse().forEach(t => {
        const card = document.createElement('div'); card.className='ticket';
        card.innerHTML = `
          <div class="t-head"><div class="id">${t.id}</div><div class="dt">${t.date} • ${t.time}</div></div>
          <div class="route"><div class="station">${t.from}</div><div class="arrow">→</div><div class="station">${t.to}</div></div>
          <div class="t-grid">
            <div><div class="mini">Train</div><div class="val">${t.train}</div></div>
            <div><div class="mini">Seats</div><div class="val">${t.seats.join(', ')}</div></div>
            <div><div class="mini">Passengers</div><div class="val">${t.pcount}</div></div>
            <div><div class="mini">Amount</div><div class="val">${fmt(t.amount)}</div></div>
          </div>
        `;
        list.appendChild(card);
      });
    }

    // ---------- INIT ----------
    (function init(){
      $('#date').value = todayISO();
      $('#date').min = todayISO();
      $('#wallet-balance').textContent = userBalance.toFixed(2);
      $('#balance').textContent = userBalance.toFixed(2);
      $('#profile-balance').textContent = userBalance.toFixed(2);

      // Tabs
      $$('.tab').forEach(tab => tab.addEventListener('click', () => setActiveScreen(tab.dataset.tab)));

      // Type selection
      $$('#type-box .type-btn').forEach(el => el.addEventListener('click', () => {
        $$('#type-box .type-btn').forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');
        booking.type = el.dataset.type;
      }));

      // Payment selection
      $$('#pay-box .type-btn').forEach(el => el.addEventListener('click', () => {
        $$('#pay-box .type-btn').forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');
        booking.pay = el.dataset.pay;
      }));

      // Step buttons
      $('#go-step-2').addEventListener('click', () => {
        booking.from = $('#from').value; booking.to = $('#to').value; booking.date = $('#date').value;
        if(!requireStep1()) return;
        renderSchedule();
        resetToStep(2);
      });
      $('#back-1').addEventListener('click', () => resetToStep(1));

      $('#go-step-3').addEventListener('click', () => { if(!requireStep2()) return; renderCoaches(); resetToStep(3); });
      $('#back-2').addEventListener('click', () => resetToStep(2));

      $('#go-step-4').addEventListener('click', () => { if(!requireStep3()) return; renderPassengerForms(); updateSummary(); resetToStep(4); });
      $('#back-3').addEventListener('click', () => resetToStep(3));

      // Passenger count change re-renders seats to re-enforce selection limit
      $('#passengers').addEventListener('change', () => { if($('#step-3').style.display!=='none'){ renderCoaches(); updateSummary(); } });

      // Confirm booking
      $('#confirm').addEventListener('click', () => {
        // Basic validations
        const need = parseInt($('#passengers').value,10);
        if(booking.passengers.filter(Boolean).length < need){
          if(!confirm('Some passenger details are empty. Proceed anyway?')) return;
        }
        const price = updateSummary().total;
        if(booking.pay==='wallet' && userBalance < price){ alert('Insufficient wallet balance. Choose UPI or Add Money.'); return; }

        // Deduct and save
        if(booking.pay==='wallet') userBalance -= price;
        $('#wallet-balance').textContent = userBalance.toFixed(2);
        $('#balance').textContent = userBalance.toFixed(2);
        $('#profile-balance').textContent = userBalance.toFixed(2);

        totalTrips += 1; moneySpent += price;
        $('#stat-trips').textContent = totalTrips;
        $('#stat-spent').textContent = fmt(moneySpent);

        const ticket = {
          id: `TKT-${Math.random().toString(36).slice(2,8).toUpperCase()}`,
          from: booking.from, to: booking.to, date: booking.date,
          time: booking.train ? booking.train.start : '--:--',
          train: booking.train ? booking.train.name : '-',
          seats: booking.seats.slice(), amount: price, pcount: need
        };
        bookedTickets.push(ticket);
        renderTickets();
        setActiveScreen('tickets');
        alert('Booking confirmed! Your ticket is ready.');

        // Reset for next booking (keep balance & stats)
        booking.from = booking.to = booking.date = ''; booking.type='standard'; booking.train=null; booking.seats=[]; booking.passengers=[]; booking.pay='wallet';
        $('#from').value=''; $('#to').value=''; $('#date').value=todayISO();
        $$('#type-box .type-btn').forEach(x=>x.classList.remove('selected')); $$('#type-box .type-btn')[0].classList.add('selected');
        resetToStep(1);
      });

      // Add Money (fake)
      $('#add-money').addEventListener('click', () => {
        const amt = parseFloat(prompt('Enter amount to add (₹):', '100'));
        if(!isNaN(amt) && amt>0){ userBalance += amt; $('#wallet-balance').textContent = userBalance.toFixed(2); $('#balance').textContent = userBalance.toFixed(2); $('#profile-balance').textContent = userBalance.toFixed(2); }
      });

      // Default screen
      setActiveScreen('booking');
      setSteps(1);
    })();
