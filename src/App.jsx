import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Music, Package, DollarSign, Calendar as CalendarIcon, Trash2, ShoppingCart, Edit2, RefreshCw, ArrowUp, ArrowDown, QrCode, X } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('sales')
  const [syncing, setSyncing] = useState(false)
  
  const [merch, setMerch] = useState([])
  const [sessionSales, setSessionSales] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [setlists, setSetlists] = useState([])
  const [treasury, setTreasury] = useState([])

  const [flashCardId, setFlashCardId] = useState(null)
  const [selectedSizes, setSelectedSizes] = useState({})
  const [cart, setCart] = useState([])

  // Digital QR Code Modal State
  const [showQrModal, setShowQrModal] = useState(false)

  // Reconciliation Modal States
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [doorIncomeInput, setDoorIncomeInput] = useState('')

  // Calendar Modal States
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [eventType, setEventType] = useState('Show')
  const [eventTitle, setEventTitle] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventGuarantee, setEventGuarantee] = useState('')
  const [eventNotes, setEventNotes] = useState('')

  // Setlist States
  const [showAddSetlist, setShowAddSetlist] = useState(false)
  const [editingSetlistId, setEditingSetlistId] = useState(null)
  const [setTitle, setSetTitle] = useState('')
  const [setVenue, setSetVenue] = useState('')
  const [showDateVal, setShowDateVal] = useState('')
  const [songInput, setSongInput] = useState('')
  const [currentSongs, setCurrentSongs] = useState([])

  // Treasury Modal States
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState('income')
  const [txWallet, setTxWallet] = useState('cash')
  const [txDesc, setTxDesc] = useState('')
  const [txCategory, setTxCategory] = useState('Merch')
  const [txAmount, setTxAmount] = useState('')

  // Inventory Add/Edit Modal & Size Matrix States
  const [showAddMerch, setShowAddMerch] = useState(false)
  const [editingMerchId, setEditingMerchId] = useState(null)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [hasMultipleSizes, setHasMultipleSizes] = useState(false)
  const [singleSizeName, setSingleSizeName] = useState('Standard')
  const [singleStock, setSingleStock] = useState('')
  const [sizeStockMatrix, setSizeStockMatrix] = useState({
    'S': 10, 'M': 15, 'L': 15, 'XL': 10, 'XXL': 5, '3XL': 2
  })

  // Fetch all data from Supabase
  async function loadData() {
    setSyncing(true)
    try {
      const { data: m } = await supabase.from('merch').select('*')
      if (m) setMerch(m)

      const { data: s } = await supabase.from('session_sales').select('*')
      if (s) setSessionSales(s)

      const { data: c } = await supabase.from('calendar_events').select('*')
      if (c) setCalendarEvents(c)

      const { data: sl } = await supabase.from('setlists').select('*')
      if (sl) setSetlists(sl)

      const { data: t } = await supabase.from('treasury').select('*')
      if (t) setTreasury(t)
    } catch (err) {
      console.error('Supabase Connection Catch:', err)
    }
    setSyncing(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const inputStyle = {
    width: '100%',
    padding: '8px',
    background: '#0F0F10',
    border: '1px solid #27272A',
    borderRadius: '4px',
    color: '#fff',
    boxSizing: 'border-box'
  }

  // POS Handlers
  function handleAddToCart(item) {
    if (item.stock_count <= 0) return
    const chosenSize = item.has_sizes ? (selectedSizes[item.id] || 'L') : item.size
    
    setFlashCardId(item.id)
    setTimeout(() => setFlashCardId(null), 250)

    const cartKey = `${item.id}-${chosenSize}`
    const existing = cart.find(c => c.cartKey === cartKey)
    if (existing) {
      if (existing.qty < item.stock_count) {
        setCart(cart.map(c => c.cartKey === cartKey ? { ...c, qty: c.qty + 1 } : c))
      }
    } else {
      setCart([...cart, { ...item, size: chosenSize, cartKey, qty: 1 }])
    }
  }

  function handleRemoveCartItem(cartKey) {
    setCart(cart.filter(c => c.cartKey !== cartKey))
  }

  async function handleCheckout(paymentType) {
    if (cart.length === 0) return
    const saleRecord = {
      id: String(Date.now()),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      payment_type: paymentType,
      items: [...cart],
      total: cart.reduce((sum, i) => sum + (i.price * i.qty), 0)
    }
    
    const { error } = await supabase.from('session_sales').insert([saleRecord])
    if (error) {
      alert('Checkout Insert Failed: ' + error.message)
      return
    }

    setSessionSales([saleRecord, ...sessionSales])
    setCart([])
    setShowQrModal(false)
  }

  const sessionItemTotals = {}
  sessionSales.forEach(sale => {
    sale.items.forEach(i => {
      sessionItemTotals[i.id] = (sessionItemTotals[i.id] || 0) + i.qty
    })
  })
  const sessionTotalMerchRevenue = sessionSales.reduce((sum, s) => sum + s.total, 0)

  const paymentBreakdowns = sessionSales.reduce((acc, sale) => {
    acc[sale.payment_type] = (acc[sale.payment_type] || 0) + sale.total
    return acc
  }, {})

  const doorIncomeVal = parseFloat(doorIncomeInput) || 0
  const grandTotalDay = sessionTotalMerchRevenue + doorIncomeVal

  async function handleConfirmReconciliation() {
    const updatedMerch = merch.map(m => {
      const soldCount = sessionItemTotals[m.id] || 0
      return { ...m, stock_count: Math.max(0, m.stock_count - soldCount) }
    })

    for (const m of updatedMerch) {
      const { error } = await supabase.from('merch').update({ stock_count: m.stock_count }).eq('id', m.id)
      if (error) {
        alert('Stock Reconciliation Update Failed: ' + error.message)
        return
      }
    }

    if (sessionTotalMerchRevenue > 0) {
      const merchTx = {
        id: String(Date.now()),
        description: `Merch Booth Settlement (${sessionSales.length} orders)`,
        category: 'Merch',
        type: 'digital',
        amount: sessionTotalMerchRevenue
      }
      await supabase.from('treasury').insert([merchTx])
      setTreasury(prev => [merchTx, ...prev])
    }

    if (doorIncomeVal > 0) {
      const doorTx = {
        id: String(Date.now() + 1),
        description: `Show Door / Guarantee Cut`,
        category: 'Show Payout',
        type: 'cash',
        amount: doorIncomeVal
      }
      await supabase.from('treasury').insert([doorTx])
      setTreasury(prev => [doorTx, ...prev])
    }

    await supabase.from('session_sales').delete().neq('id', '0')

    setMerch(updatedMerch)
    setSessionSales([])
    setShowReconcileModal(false)
    setDoorIncomeInput('')
  }

  // Inventory Handlers
  async function handleSaveMerchItem(e) {
    e.preventDefault()
    if (!newName || !newPrice) return
    const totalCalculatedStock = hasMultipleSizes 
      ? Object.values(sizeStockMatrix).reduce((a, b) => a + Number(b), 0)
      : (parseInt(singleStock) || 0)

    if (editingMerchId) {
      const updatedItem = {
        item_name: newName,
        size: hasMultipleSizes ? 'Assorted Sizes' : (singleSizeName || 'Standard'),
        price: parseFloat(newPrice) || 0,
        stock_count: totalCalculatedStock,
        has_sizes: hasMultipleSizes
      }

      const { error } = await supabase.from('merch').update(updatedItem).eq('id', editingMerchId)
      if (error) {
        alert('Merch Update Failed: ' + error.message)
        return
      }

      setMerch(merch.map(m => m.id === editingMerchId ? { ...m, ...updatedItem } : m))
      setEditingMerchId(null)
    } else {
      const newItem = { 
        id: String(Date.now()), 
        item_name: newName, 
        size: hasMultipleSizes ? 'Assorted Sizes' : (singleSizeName || 'Standard'), 
        price: parseFloat(newPrice) || 0, 
        stock_count: totalCalculatedStock,
        has_sizes: hasMultipleSizes 
      }

      const { error } = await supabase.from('merch').insert([newItem])
      if (error) {
        alert('Merch Insert Failed: ' + error.message)
        return
      }

      setMerch([newItem, ...merch])
    }

    setNewName(''); setNewPrice(''); setHasMultipleSizes(false); setSingleStock(''); setShowAddMerch(false)
  }

  async function deleteMerch(id) {
    const { error } = await supabase.from('merch').delete().eq('id', id)
    if (error) {
      alert('Merch Delete Failed: ' + error.message)
      return
    }
    setMerch(merch.filter(m => m.id !== id))
  }

  // Calendar Handlers
  async function handleSaveEvent(e) {
    e.preventDefault()
    if (!eventTitle || !eventDate) return

    if (editingEventId) {
      const updatedEvent = {
        type: eventType,
        title: eventTitle,
        location: eventLocation || 'TBD',
        date: eventDate,
        guarantee: parseFloat(eventGuarantee) || 0,
        notes: eventNotes || ''
      }

      const { error } = await supabase.from('calendar_events').update(updatedEvent).eq('id', editingEventId)
      if (error) {
        alert('Event Update Failed: ' + error.message)
        return
      }

      setCalendarEvents(calendarEvents.map(ev => ev.id === editingEventId ? { ...ev, ...updatedEvent } : ev))
      setEditingEventId(null)
    } else {
      const newEv = {
        id: String(Date.now()),
        type: eventType,
        title: eventTitle,
        location: eventLocation || 'TBD',
        date: eventDate,
        guarantee: parseFloat(eventGuarantee) || 0,
        votes: [],
        promoter_confirmed: false,
        notes: eventNotes || ''
      }

      const { error } = await supabase.from('calendar_events').insert([newEv])
      if (error) {
        alert('Event Insert Failed: ' + error.message)
        return
      }

      setCalendarEvents([newEv, ...calendarEvents])
    }

    setEventTitle(''); setEventLocation(''); setEventDate(''); setEventGuarantee(''); setEventNotes(''); setShowAddEvent(false)
  }

  async function handleVote(eventId, memberName) {
    const target = calendarEvents.find(ev => ev.id === eventId)
    if (!target) return
    const hasVoted = target.votes.includes(memberName)
    const newVotes = hasVoted ? target.votes.filter(v => v !== memberName) : [...target.votes, memberName]

    const { error } = await supabase.from('calendar_events').update({ votes: newVotes }).eq('id', eventId)
    if (error) {
      alert('Vote Update Failed: ' + error.message)
      return
    }

    setCalendarEvents(calendarEvents.map(ev => ev.id === eventId ? { ...ev, votes: newVotes } : ev))
  }

  async function togglePromoterConfirm(eventId) {
    const target = calendarEvents.find(ev => ev.id === eventId)
    if (!target) return
    const newStatus = !target.promoter_confirmed

    const { error } = await supabase.from('calendar_events').update({ promoter_confirmed: newStatus }).eq('id', eventId)
    if (error) {
      alert('Promoter Confirm Update Failed: ' + error.message)
      return
    }

    setCalendarEvents(calendarEvents.map(ev => ev.id === eventId ? { ...ev, promoter_confirmed: newStatus } : ev))
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) {
      alert('Event Delete Failed: ' + error.message)
      return
    }
    setCalendarEvents(calendarEvents.filter(ev => ev.id !== id))
  }

  // Setlist Handlers
  function handleAddSong() {
    if (!songInput.trim()) return
    setCurrentSongs([...currentSongs, songInput.trim()])
    setSongInput('')
  }

  function handleRemoveSong(index) {
    setCurrentSongs(currentSongs.filter((_, i) => i !== index))
  }

  function handleMoveSong(index, direction) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= currentSongs.length) return
    const updated = [...currentSongs]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setCurrentSongs(updated)
  }

  async function handleSaveSetlist(e) {
    e.preventDefault()
    if (!setTitle) return

    if (editingSetlistId) {
      const updatedSet = {
        title: setTitle,
        name: setTitle,
        venue: setVenue || 'TBD',
        show_date: showDateVal || 'Upcoming',
        songs: currentSongs.length > 0 ? currentSongs : ['Default Jam']
      }

      const { error } = await supabase.from('setlists').update(updatedSet).eq('id', editingSetlistId)
      if (error) {
        alert('Setlist Update Failed: ' + error.message)
        return
      }

      setSetlists(setlists.map(s => s.id === editingSetlistId ? { ...s, ...updatedSet } : s))
      setEditingSetlistId(null)
    } else {
      const newSet = {
        id: String(Date.now()),
        title: setTitle,
        name: setTitle,
        venue: setVenue || 'TBD',
        show_date: showDateVal || 'Upcoming',
        songs: currentSongs.length > 0 ? currentSongs : ['Default Jam']
      }

      const { error } = await supabase.from('setlists').insert([newSet])
      if (error) {
        alert('Setlist Insert Failed: ' + error.message)
        return
      }

      setSetlists([newSet, ...setlists])
    }

    setSetTitle(''); setSetVenue(''); setShowDateVal(''); setCurrentSongs([]); setShowAddSetlist(false)
  }

  async function deleteSetlist(id) {
    const { error } = await supabase.from('setlists').delete().eq('id', id)
    if (error) {
      alert('Setlist Delete Failed: ' + error.message)
      return
    }
    setSetlists(setlists.filter(s => s.id !== id))
  }

  // Treasury Handlers
  async function handleAddTransaction(e) {
    e.preventDefault()
    if (!txDesc || !txAmount) return
    const rawVal = parseFloat(txAmount) || 0
    const finalAmount = txType === 'expense' ? -Math.abs(rawVal) : Math.abs(rawVal)
    const newTx = {
      id: String(Date.now()),
      description: txDesc,
      category: txCategory,
      type: txWallet,
      amount: finalAmount
    }

    const { error } = await supabase.from('treasury').insert([newTx])
    if (error) {
      alert('Transaction Insert Failed: ' + error.message)
      return
    }

    setTreasury([newTx, ...treasury])
    setTxDesc(''); setTxAmount(''); setShowTxModal(false)
  }

  async function deleteTransaction(id) {
    if (!window.confirm('Are you sure you want to delete this transaction line item?')) return

    const { error } = await supabase.from('treasury').delete().eq('id', id)
    if (error) {
      alert('Transaction Delete Failed: ' + error.message)
      return
    }
    setTreasury(treasury.filter(t => t.id !== id))
  }

  const cashBalance = treasury.filter(t => t.type === 'cash').reduce((sum, t) => sum + Number(t.amount), 0)
  const digitalBalance = treasury.filter(t => t.type === 'digital').reduce((sum, t) => sum + Number(t.amount), 0)
  const cartTotalAmount = cart.reduce((s, i) => s + (i.price * i.qty), 0)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', background: '#0F0F10', color: '#E4E4E7', minHeight: '100vh', paddingBottom: '140px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      
      <header style={{ padding: '16px', background: '#18181B', borderBottom: '1px solid #27272A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>BAND MANAGER</h1>
          <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Cloud Sync Active</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={loadData} title="Sync with Cloud" style={{ background: '#27272A', border: 'none', color: '#3B82F6', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            <RefreshCw size={14} /> {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <span style={{ fontSize: '11px', background: '#27272A', padding: '4px 8px', borderRadius: '4px', color: '#22C55E', fontWeight: 'bold' }}>
            {activeTab.toUpperCase()}
          </span>
        </div>
      </header>

      <main style={{ padding: '16px' }}>

        {/* 1. SALES POS TAB */}
        {activeTab === 'sales' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Live Booth POS</h2>
                <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Merch Sales Total: ${sessionTotalMerchRevenue.toFixed(2)} ({sessionSales.length} orders)</p>
              </div>
              {sessionSales.length > 0 && (
                <button onClick={() => setShowReconcileModal(true)} style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Reconcile Night
                </button>
              )}
            </div>

            {/* Digital QR Code Modal */}
            {showQrModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '16px' }}>
                <div style={{ background: '#18181B', border: '2px solid #9333EA', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '340px', textAlign: 'center', position: 'relative' }}>
                  <button onClick={() => setShowQrModal(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#9333EA', marginBottom: '4px' }}>
                    <QrCode size={22} />
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Scan to Pay</h3>
                  </div>
                  <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '0 0 14px 0' }}>CashApp Digital Checkout</p>

                  <div style={{ background: '#27272A', padding: '10px 16px', borderRadius: '8px', marginBottom: '14px', display: 'inline-block' }}>
                    <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#22C55E' }}>${cartTotalAmount.toFixed(2)}</span>
                  </div>

                  {/* CashApp QR Code Image */}
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                      src="/cashapp.jpg" 
                      alt="CashApp QR Code" 
                      style={{ width: '200px', height: '200px', objectFit: 'contain', borderRadius: '4px' }} 
                    />
                  </div>

                  <button 
                    onClick={() => handleCheckout('Digital')}
                    style={{ width: '100%', background: '#9333EA', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ✓ Confirm Digital Payment Received
                  </button>
                </div>
              </div>
            )}

            {showReconcileModal && (
              <div style={{ background: '#18181B', border: '2px solid #22C55E', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#22C55E' }}>Nightly Reconciliation Summary</h3>
                
                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', background: '#0F0F10', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#A1A1AA' }}>Total Transactions:</span>
                    <span style={{ fontWeight: 'bold' }}>{sessionSales.length} orders</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#A1A1AA' }}>Merch Revenue:</span>
                    <span style={{ fontWeight: 'bold', color: '#22C55E' }}>${sessionTotalMerchRevenue.toFixed(2)}</span>
                  </div>
                  {Object.entries(paymentBreakdowns).map(([method, total]) => (
                    <div key={method} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px', fontSize: '12px' }}>
                      <span style={{ color: '#71717A' }}>• {method} Payments:</span>
                      <span style={{ color: '#D4D4D8' }}>${total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#A1A1AA', display: 'block', marginBottom: '4px' }}>Door / Show Guarantee Payout ($):</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g. 350.00" 
                    value={doorIncomeInput} 
                    onChange={e => setDoorIncomeInput(e.target.value)} 
                    style={inputStyle} 
                  />
                </div>

                <div style={{ background: '#121214', padding: '10px', borderRadius: '6px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Grand Total (Merch + Door):</span>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#22C55E' }}>${grandTotalDay.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleConfirmReconciliation} style={{ flex: 1, background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Confirm & Transfer to Treasury
                  </button>
                  <button onClick={() => setShowReconcileModal(false)} style={{ background: '#27272A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {merch.map(item => {
                const soldQty = sessionItemTotals[item.id] || 0
                const isSoldOut = item.stock_count <= 0
                const isFlashing = flashCardId === item.id

                return (
                  <div 
                    key={item.id}
                    style={{
                      background: isSoldOut ? '#121214' : '#18181B',
                      border: isFlashing ? '2px solid #22C55E' : '1px solid #27272A',
                      borderRadius: '8px',
                      padding: '12px',
                      opacity: isSoldOut ? 0.5 : 1,
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    {soldQty > 0 && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#2563EB', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>
                        Sold: {soldQty}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{item.item_name}</h3>
                      <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '0 0 8px 0' }}>{item.has_sizes ? 'Sizes: S - 3XL' : item.size}</p>
                    </div>

                    <div>
                      {item.has_sizes && (
                        <select 
                          value={selectedSizes[item.id] || 'L'} 
                          onChange={(e) => setSelectedSizes({...selectedSizes, [item.id]: e.target.value})}
                          style={{ width: '100%', padding: '4px', background: '#0F0F10', border: '1px solid #27272A', borderRadius: '4px', color: '#fff', fontSize: '11px', marginBottom: '8px' }}
                        >
                          {['S', 'M', 'L', 'XL', 'XXL', '3XL'].map(sz => <option key={sz} value={sz}>Size: {sz}</option>)}
                        </select>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#22C55E' }}>${item.price}</span>
                        <span style={{ fontSize: '10px', color: '#71717A' }}>Stock: {item.stock_count}</span>
                      </div>

                      <button 
                        disabled={isSoldOut}
                        onClick={() => handleAddToCart(item)}
                        style={{ width: '100%', background: isSoldOut ? '#27272A' : '#2563EB', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: isSoldOut ? 'not-allowed' : 'pointer' }}
                      >
                        + Add to Cart
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Today's Session Sales Ledger</h3>
            {sessionSales.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#71717A' }}>No sales recorded yet today.</p>
            ) : (
              sessionSales.map(sale => (
                <div key={sale.id} style={{ background: '#18181B', padding: '10px 12px', borderRadius: '6px', border: '1px solid #27272A', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: '#3B82F6', fontWeight: 'bold' }}>{sale.payment_type}</span> • <span style={{ color: '#A1A1AA' }}>{sale.timestamp}</span>
                    <p style={{ margin: '2px 0 0 0', color: '#D4D4D8' }}>{sale.items.map(i => `${i.qty}x ${i.item_name} (${i.size})`).join(', ')}</p>
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#22C55E' }}>${sale.total.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 2. INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Merch Inventory</h2>
                <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Cloud synced inventory counts</p>
              </div>
              <button onClick={() => { setEditingMerchId(null); setNewName(''); setNewPrice(''); setHasMultipleSizes(false); setSingleStock(''); setShowAddMerch(!showAddMerch) }} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {showAddMerch ? 'Cancel' : '+ Add Item'}
              </button>
            </div>

            {showAddMerch && (
              <form onSubmit={handleSaveMerchItem} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#3B82F6' }}>{editingMerchId ? 'Edit Merch Item' : 'Add New Merch Item'}</h3>
                
                <input type="text" placeholder="Item Name (e.g. Tour Hoodie)" value={newName} onChange={e => setNewName(e.target.value)} required style={{ ...inputStyle, marginBottom: '8px' }} />
                
                <input type="number" step="0.01" placeholder="Price $" value={newPrice} onChange={e => setNewPrice(e.target.value)} required style={{ ...inputStyle, marginBottom: '8px' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', background: '#121214', padding: '8px', borderRadius: '4px', border: '1px solid #27272A' }}>
                  <input type="checkbox" id="multiSize" checked={hasMultipleSizes} onChange={e => setHasMultipleSizes(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }} />
                  <label htmlFor="multiSize" style={{ fontSize: '12px', color: '#E4E4E7', cursor: 'pointer', fontWeight: 'bold' }}>Item comes in multiple sizes (S - 3XL)</label>
                </div>

                {!hasMultipleSizes ? (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input type="text" placeholder="Size (e.g. Standard)" value={singleSizeName} onChange={e => setSingleSizeName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <input type="number" placeholder="Initial Stock" value={singleStock} onChange={e => setSingleStock(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ) : (
                  <div style={{ background: '#0F0F10', padding: '8px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #27272A' }}>
                    <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '0 0 6px 0' }}>Stock per Size:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {['S', 'M', 'L', 'XL', 'XXL', '3XL'].map(sz => (
                        <div key={sz}>
                          <label style={{ fontSize: '10px', color: '#71717A', display: 'block' }}>{sz}</label>
                          <input 
                            type="number" 
                            value={sizeStockMatrix[sz]} 
                            onChange={(e) => setSizeStockMatrix({...sizeStockMatrix, [sz]: parseInt(e.target.value) || 0})}
                            style={{ ...inputStyle, padding: '4px', textAlign: 'center', fontSize: '12px' }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {editingMerchId ? 'Update Item' : 'Save Item'}
                </button>
              </form>
            )}

            {merch.map(item => {
              const stock = item.stock_count
              const alertBg = stock < 5 ? '#450A0A' : stock <= 10 ? '#422006' : '#18181B'
              const alertBorder = stock < 5 ? '#EF4444' : stock <= 10 ? '#EAB308' : '#27272A'
              const stockColor = stock < 5 ? '#F87171' : stock <= 10 ? '#FACC15' : '#22C55E'

              return (
                <div key={item.id} style={{ background: alertBg, padding: '12px 14px', borderRadius: '8px', border: `1px solid ${alertBorder}`, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{item.item_name} <span style={{ color: '#A1A1AA', fontSize: '12px' }}>({item.has_sizes ? 'S - 3XL' : item.size})</span></h3>
                    <p style={{ fontSize: '12px', color: stockColor, fontWeight: '600', margin: '2px 0 0 0' }}>
                      ${item.price} • Stock: {stock} {stock < 5 ? '⚠️ (CRITICAL LOW)' : stock <= 10 ? '⚠️ (LOW STOCK)' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => {
                      setEditingMerchId(item.id)
                      setNewName(item.item_name)
                      setNewPrice(item.price)
                      setHasMultipleSizes(item.has_sizes || false)
                      if (!item.has_sizes) setSingleStock(item.stock_count)
                      setShowAddMerch(true)
                    }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', padding: 0 }} title="Edit Item">
                      <Edit2 size={16} />
                    </button>

                    <button onClick={() => deleteMerch(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }} title="Delete Item">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 3. CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Band Calendar</h2>
                <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Shows, practices, and quorum votes</p>
              </div>
              <button onClick={() => { setEditingEventId(null); setEventTitle(''); setEventLocation(''); setEventDate(''); setEventGuarantee(''); setEventNotes(''); setShowAddEvent(!showAddEvent) }} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {showAddEvent ? 'Cancel' : '+ Add Date'}
              </button>
            </div>

            {showAddEvent && (
              <form onSubmit={handleSaveEvent} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select value={eventType} onChange={e => setEventType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="Show">Show</option>
                    <option value="Practice">Practice</option>
                    <option value="Blackout">Blackout</option>
                  </select>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                </div>
                <input type="text" placeholder="Title / Venue Name" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required style={{ ...inputStyle, marginBottom: '8px' }} />
                <input type="text" placeholder="Location / City" value={eventLocation} onChange={e => setEventLocation(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
                {eventType === 'Show' && (
                  <input type="number" placeholder="Guarantee Payout ($)" value={eventGuarantee} onChange={e => setEventGuarantee(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
                )}
                <textarea placeholder="Notes (Load-in time, parking info, etc.)" value={eventNotes} onChange={e => setEventNotes(e.target.value)} style={{ ...inputStyle, marginBottom: '8px', height: '60px' }} />
                <button type="submit" style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>{editingEventId ? 'Update Date' : 'Save to Calendar'}</button>
              </form>
            )}

            {calendarEvents.map(ev => {
              const isBandConfirmed = ev.votes.length >= 3
              return (
                <div key={ev.id} style={{ background: '#18181B', padding: '14px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <span style={{ fontSize: '10px', background: ev.type === 'Show' ? '#2563EB' : ev.type === 'Practice' ? '#16A34A' : '#EF4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {ev.type.toUpperCase()}
                      </span>
                      <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '4px 0 2px 0' }}>{ev.title}</h3>
                      <p style={{ fontSize: '12px', color: '#A1A1AA', margin: 0 }}>{ev.location} • {ev.date}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {ev.type === 'Show' && (
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#22C55E' }}>${ev.guarantee}</span>
                      )}
                      <button onClick={() => { setEditingEventId(ev.id); setEventType(ev.type); setEventTitle(ev.title); setEventLocation(ev.location); setEventDate(ev.date); setEventGuarantee(ev.guarantee || ''); setEventNotes(ev.notes || ''); setShowAddEvent(true); }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', padding: 0 }} title="Edit Event">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }} title="Delete Event">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#0F0F10', padding: '8px', borderRadius: '6px', margin: '10px 0', border: '1px solid #27272A', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ color: isBandConfirmed ? '#22C55E' : '#EAB308', fontWeight: 'bold' }}>
                        {isBandConfirmed ? '✓ Band Confirmed (3+ Yes)' : `Band Quorum: ${ev.votes.length}/3 Yes votes`}
                      </span>
                      <button onClick={() => togglePromoterConfirm(ev.id)} style={{ background: ev.promoter_confirmed ? '#166534' : '#27272A', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                        {ev.promoter_confirmed ? '✓ Promoter Confirmed' : 'Promoter Unconfirmed'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['Guitar', 'Drums', 'Bass', 'Vocals'].map(member => {
                        const hasVoted = ev.votes.includes(member)
                        return (
                          <button key={member} onClick={() => handleVote(ev.id, member)} style={{ background: hasVoted ? '#16A34A' : '#27272A', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', flex: 1 }}>
                            {member}: {hasVoted ? 'YES' : 'No'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {ev.notes && (
                    <div style={{ fontSize: '12px', color: '#D4D4D8', background: '#121214', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #3B82F6' }}>
                      <strong>Notes:</strong> {ev.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 4. SETLISTS TAB */}
        {activeTab === 'setlists' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Setlists</h2>
                <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Running orders & song lists</p>
              </div>
              <button onClick={() => {
                setEditingSetlistId(null)
                setSetTitle('')
                setSetVenue('')
                setShowDateVal('')
                setCurrentSongs([])
                setShowAddSetlist(!showAddSetlist)
              }} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {showAddSetlist ? 'Cancel' : '+ New Setlist'}
              </button>
            </div>

            {showAddSetlist && (
              <form onSubmit={handleSaveSetlist} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#3B82F6' }}>
                  {editingSetlistId ? 'Edit Setlist' : 'Create New Setlist'}
                </h3>
                <input type="text" placeholder="Set / Show Title" value={setTitle} onChange={e => setSetTitle(e.target.value)} required style={{ ...inputStyle, marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Venue Name" value={setVenue} onChange={e => setSetVenue(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <input type="date" value={showDateVal} onChange={e => setShowDateVal(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                </div>

                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input type="text" placeholder="Song Title" value={songInput} onChange={e => setSongInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={handleAddSong} style={{ background: '#27272A', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Add Song</button>
                </div>

                {currentSongs.length > 0 && (
                  <div style={{ background: '#0F0F10', padding: '8px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #27272A' }}>
                    <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '0 0 6px 0' }}>Set Running Order (Use arrows to reorder):</p>
                    {currentSongs.map((song, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: idx < currentSongs.length - 1 ? '1px solid #18181B' : 'none' }}>
                        <span style={{ fontSize: '12px', color: '#D4D4D8' }}>{idx + 1}. {song}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button type="button" disabled={idx === 0} onClick={() => handleMoveSong(idx, -1)} style={{ background: '#27272A', color: idx === 0 ? '#52525B' : '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: idx === 0 ? 'default' : 'pointer' }} title="Move Up"><ArrowUp size={12} /></button>
                          <button type="button" disabled={idx === currentSongs.length - 1} onClick={() => handleMoveSong(idx, 1)} style={{ background: '#27272A', color: idx === currentSongs.length - 1 ? '#52525B' : '#fff', border: 'none', padding: '2px 6px', borderRadius: '3px', cursor: idx === currentSongs.length - 1 ? 'default' : 'pointer' }} title="Move Down"><ArrowDown size={12} /></button>
                          <button type="button" onClick={() => handleRemoveSong(idx)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, marginLeft: '4px' }} title="Remove Song"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button type="submit" style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {editingSetlistId ? 'Update Setlist' : 'Save Setlist'}
                </button>
              </form>
            )}

            {setlists.map(list => (
              <div key={list.id} style={{ background: '#18181B', padding: '14px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{list.title}</h3>
                    <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 6px 0' }}>{list.venue} • {list.show_date}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => {
                      setEditingSetlistId(list.id)
                      setSetTitle(list.title || '')
                      setSetVenue(list.venue || '')
                      setShowDateVal(list.show_date || '')
                      setCurrentSongs(list.songs || [])
                      setShowAddSetlist(true)
                    }} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', padding: 0 }} title="Edit Setlist">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deleteSetlist(list.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }} title="Delete Setlist">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#D4D4D8' }}>
                  {(list.songs || []).map((song, i) => <li key={i} style={{ padding: '2px 0' }}>{song}</li>)}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* 5. TREASURY TAB */}
        {activeTab === 'treasury' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Band Treasury</h2>
              <button onClick={() => setShowTxModal(true)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                + Add Transaction
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A' }}>
                <p style={{ fontSize: '10px', color: '#A1A1AA', margin: 0 }}>CASH ON HAND</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#22C55E', margin: '2px 0 0 0' }}>${cashBalance.toFixed(2)}</h3>
              </div>
              <div style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A' }}>
                <p style={{ fontSize: '10px', color: '#A1A1AA', margin: 0 }}>DIGITAL (VENMO/PP/CA)</p>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#3B82F6', margin: '2px 0 0 0' }}>${digitalBalance.toFixed(2)}</h3>
              </div>
            </div>

            {showTxModal && (
              <form onSubmit={handleAddTransaction} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select value={txType} onChange={e => setTxType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="income">Income (+)</option>
                    <option value="expense">Expense (-)</option>
                  </select>
                  <select value={txWallet} onChange={e => setTxWallet(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="cash">Cash on Hand</option>
                    <option value="digital">Digital (Venmo/CA)</option>
                  </select>
                </div>
                <input type="text" placeholder="Description (e.g. Door Cut / Gas)" value={txDesc} onChange={e => setTxDesc(e.target.value)} required style={{ ...inputStyle, marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select value={txCategory} onChange={e => setTxCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="Merch">Merch</option>
                    <option value="Show Payout">Show Payout</option>
                    <option value="Travel">Travel / Gas</option>
                    <option value="Gear">Gear & Studio</option>
                    <option value="Other">Other</option>
                  </select>
                  <input type="number" step="0.01" placeholder="Amount $" value={txAmount} onChange={e => setTxAmount(e.target.value)} required style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" style={{ flex: 1, background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save Transaction</button>
                  <button type="button" onClick={() => setShowTxModal(false)} style={{ background: '#27272A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            )}

            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Transaction History</h3>
            {treasury.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#71717A' }}>No transactions recorded yet.</p>
            ) : (
              treasury.map(tx => (
                <div key={tx.id} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '13px', margin: 0 }}>{tx.description}</p>
                    <p style={{ fontSize: '11px', color: '#71717A', margin: '2px 0 0 0' }}>{tx.category} • <span style={{ color: tx.type === 'cash' ? '#22C55E' : '#3B82F6' }}>{tx.type.toUpperCase()}</span></p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', color: Number(tx.amount) >= 0 ? '#22C55E' : '#EF4444' }}>
                      {Number(tx.amount) >= 0 ? `+$${Number(tx.amount).toFixed(2)}` : `-$${Math.abs(Number(tx.amount)).toFixed(2)}`}
                    </span>
                    <button onClick={() => deleteTransaction(tx.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }} title="Delete Transaction">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Sticky Checkout Drawer */}
      {activeTab === 'sales' && cart.length > 0 && (
        <div style={{ position: 'fixed', bottom: '65px', left: 0, right: 0, maxWidth: '480px', margin: '0 auto', background: '#18181B', borderTop: '2px solid #2563EB', padding: '12px 16px', boxSizing: 'border-box', boxShadow: '0 -4px 12px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Cart Total: </span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#22C55E' }}>${cartTotalAmount.toFixed(2)}</span>
            </div>
            <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>Clear All</button>
          </div>

          <div style={{ maxHeight: '100px', overflowY: 'auto', marginBottom: '10px', background: '#0F0F10', padding: '6px', borderRadius: '4px', border: '1px solid #27272A' }}>
            {cart.map(cItem => (
              <div key={cItem.cartKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid #18181B' }}>
                <span style={{ color: '#D4D4D8' }}>{cItem.qty}x {cItem.item_name} ({cItem.size})</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#22C55E', fontWeight: 'bold' }}>${(cItem.price * cItem.qty).toFixed(2)}</span>
                  <button onClick={() => handleRemoveCartItem(cItem.cartKey)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }} title="Remove Item">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleCheckout('Cash')} style={{ flex: 1, background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>💵 CASH</button>
            <button onClick={() => handleCheckout('Card')} style={{ flex: 1, background: '#2563EB', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>💳 CARD</button>
            <button onClick={() => setShowQrModal(true)} style={{ flex: 1, background: '#9333EA', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>📱 DIGITAL</button>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '480px', margin: '0 auto', background: '#18181B', borderTop: '1px solid #27272A', display: 'flex', justifyContent: 'space-around', padding: '10px 0', boxSizing: 'border-box' }}>
        <button onClick={() => setActiveTab('sales')} style={{ background: 'none', border: 'none', color: activeTab === 'sales' ? '#3B82F6' : '#71717A', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}><ShoppingCart size={18} /><span style={{ marginTop: '2px' }}>Sales</span></button>
        <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', color: activeTab === 'inventory' ? '#3B82F6' : '#71717A', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}><Package size={18} /><span style={{ marginTop: '2px' }}>Inventory</span></button>
        <button onClick={() => setActiveTab('calendar')} style={{ background: 'none', border: 'none', color: activeTab === 'calendar' ? '#3B82F6' : '#71717A', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}><CalendarIcon size={18} /><span style={{ marginTop: '2px' }}>Calendar</span></button>
        <button onClick={() => setActiveTab('setlists')} style={{ background: 'none', border: 'none', color: activeTab === 'setlists' ? '#3B82F6' : '#71717A', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}><Music size={18} /><span style={{ marginTop: '2px' }}>Setlists</span></button>
        <button onClick={() => setActiveTab('treasury')} style={{ background: 'none', border: 'none', color: activeTab === 'treasury' ? '#3B82F6' : '#71717A', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '11px', cursor: 'pointer' }}><DollarSign size={18} /><span style={{ marginTop: '2px' }}>Treasury</span></button>
      </nav>

    </div>
  )
}