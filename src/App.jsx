import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Music, Package, DollarSign, Calendar as CalendarIcon, Plus, Minus, Trash2, ShoppingCart, Edit2, RefreshCw } from 'lucide-react'

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

  // Inventory Add Modal & Size Matrix States
  const [showAddMerch, setShowAddMerch] = useState(false)
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
      const { data: m, error: me } = await supabase.from('merch').select('*')
      if (me) console.error('Merch fetch error:', me)
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
      console.error('Supabase connection error:', err)
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

  async function handleCheckout(paymentType) {
    if (cart.length === 0) return
    const saleRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      payment_type: paymentType,
      items: [...cart],
      total: cart.reduce((sum, i) => sum + (i.price * i.qty), 0)
    }
    const updatedSales = [saleRecord, ...sessionSales]
    setSessionSales(updatedSales)
    setCart([])
    const { error } = await supabase.from('session_sales').insert([saleRecord])
    if (error) console.error('Checkout insert error:', error)
  }

  const sessionItemTotals = {}
  sessionSales.forEach(sale => {
    sale.items.forEach(i => {
      sessionItemTotals[i.id] = (sessionItemTotals[i.id] || 0) + i.qty
    })
  })
  const sessionTotalRevenue = sessionSales.reduce((sum, s) => sum + s.total, 0)

  async function handleCompleteReconciliation() {
    if (sessionSales.length === 0) return
    
    const updatedMerch = merch.map(m => {
      const soldCount = sessionItemTotals[m.id] || 0
      return { ...m, stock_count: Math.max(0, m.stock_count - soldCount) }
    })
    setMerch(updatedMerch)

    for (const m of updatedMerch) {
      await supabase.from('merch').update({ stock_count: m.stock_count }).eq('id', m.id)
    }

    const aggregatedTx = {
      id: Date.now().toString(),
      description: `Merch Booth Settlement (${sessionSales.length} orders)`,
      category: 'Merch',
      type: 'digital',
      amount: sessionTotalRevenue
    }
    const updatedTreasury = [aggregatedTx, ...treasury]
    setTreasury(updatedTreasury)
    await supabase.from('treasury').insert([aggregatedTx])

    setSessionSales([])
    await supabase.from('session_sales').delete().neq('id', '0')
  }

  // Inventory Handlers
  async function handleAddMerchItem(e) {
    e.preventDefault()
    if (!newName || !newPrice) return
    const totalCalculatedStock = hasMultipleSizes 
      ? Object.values(sizeStockMatrix).reduce((a, b) => a + Number(b), 0)
      : (parseInt(singleStock) || 0)

    const newItem = { 
      id: Date.now().toString(), 
      item_name: newName, 
      size: hasMultipleSizes ? 'Assorted Sizes' : (singleSizeName || 'Standard'), 
      price: parseFloat(newPrice) || 0, 
      stock_count: totalCalculatedStock,
      has_sizes: hasMultipleSizes 
    }

    setMerch([newItem, ...merch])
    const { error } = await supabase.from('merch').insert([newItem])
    if (error) console.error('Add merch error:', error)

    setNewName(''); setNewPrice(''); setHasMultipleSizes(false); setSingleStock(''); setShowAddMerch(false)
  }

  async function updateStock(id, delta) {
    const updated = merch.map(m => {
      if (m.id === id) {
        const newStock = Math.max(0, m.stock_count + delta)
        return { ...m, stock_count: newStock }
      }
      return m
    })
    setMerch(updated)
    const target = updated.find(m => m.id === id)
    await supabase.from('merch').update({ stock_count: target.stock_count }).eq('id', id)
  }

  async function deleteMerch(id) {
    setMerch(merch.filter(m => m.id !== id))
    await supabase.from('merch').delete().eq('id', id)
  }

  // Calendar Handlers
  async function handleSaveEvent(e) {
    e.preventDefault()
    if (!eventTitle || !eventDate) return

    if (editingEventId) {
      const updatedList = calendarEvents.map(ev => ev.id === editingEventId ? {
        ...ev,
        type: eventType,
        title: eventTitle,
        location: eventLocation || 'TBD',
        date: eventDate,
        guarantee: parseFloat(eventGuarantee) || 0,
        notes: eventNotes || ''
      } : ev)
      setCalendarEvents(updatedList)
      const target = updatedList.find(ev => ev.id === editingEventId)
      await supabase.from('calendar_events').update(target).eq('id', editingEventId)
      setEditingEventId(null)
    } else {
      const newEv = {
        id: Date.now().toString(),
        type: eventType,
        title: eventTitle,
        location: eventLocation || 'TBD',
        date: eventDate,
        guarantee: parseFloat(eventGuarantee) || 0,
        votes: [],
        promoter_confirmed: false,
        notes: eventNotes || ''
      }
      setCalendarEvents([newEv, ...calendarEvents])
      await supabase.from('calendar_events').insert([newEv])
    }

    setEventTitle(''); setEventLocation(''); setEventDate(''); setEventGuarantee(''); setEventNotes(''); setShowAddEvent(false)
  }

  async function handleVote(eventId, memberName) {
    const updated = calendarEvents.map(ev => {
      if (ev.id !== eventId) return ev
      const hasVoted = ev.votes.includes(memberName)
      const newVotes = hasVoted ? ev.votes.filter(v => v !== memberName) : [...ev.votes, memberName]
      return { ...ev, votes: newVotes }
    })
    setCalendarEvents(updated)
    const target = updated.find(ev => ev.id === eventId)
    await supabase.from('calendar_events').update({ votes: target.votes }).eq('id', eventId)
  }

  async function togglePromoterConfirm(eventId) {
    const updated = calendarEvents.map(ev => ev.id === eventId ? { ...ev, promoter_confirmed: !ev.promoter_confirmed } : ev)
    setCalendarEvents(updated)
    const target = updated.find(ev => ev.id === eventId)
    await supabase.from('calendar_events').update({ promoter_confirmed: target.promoter_confirmed }).eq('id', eventId)
  }

  async function deleteEvent(id) {
    setCalendarEvents(calendarEvents.filter(ev => ev.id !== id))
    await supabase.from('calendar_events').delete().eq('id', id)
  }

  // Setlist Handlers
  function handleAddSong() {
    if (!songInput.trim()) return
    setCurrentSongs([...currentSongs, songInput.trim()])
    setSongInput('')
  }

  async function handleSaveSetlist(e) {
    e.preventDefault()
    if (!setTitle) return
    const newSet = {
      id: Date.now().toString(),
      title: setTitle,
      venue: setVenue || 'TBD',
      show_date: showDateVal || 'Upcoming',
      songs: currentSongs.length > 0 ? currentSongs : ['Default Jam']
    }
    setSetlists([newSet, ...setlists])
    await supabase.from('setlists').insert([newSet])
    setSetTitle(''); setSetVenue(''); setShowDateVal(''); setCurrentSongs([]); setShowAddSetlist(false)
  }

  async function deleteSetlist(id) {
    setSetlists(setlists.filter(s => s.id !== id))
    await supabase.from('setlists').delete().eq('id', id)
  }

  // Treasury Handlers
  async function handleAddTransaction(e) {
    e.preventDefault()
    if (!txDesc || !txAmount) return
    const rawVal = parseFloat(txAmount) || 0
    const finalAmount = txType === 'expense' ? -Math.abs(rawVal) : Math.abs(rawVal)
    const newTx = {
      id: Date.now().toString(),
      description: txDesc,
      category: txCategory,
      type: txWallet,
      amount: finalAmount
    }
    setTreasury([newTx, ...treasury])
    await supabase.from('treasury').insert([newTx])
    setTxDesc(''); setTxAmount(''); setShowTxModal(false)
  }

  async function deleteTransaction(id) {
    setTreasury(treasury.filter(t => t.id !== id))
    await supabase.from('treasury').delete().eq('id', id)
  }

  const cashBalance = treasury.filter(t => t.type === 'cash').reduce((sum, t) => sum + Number(t.amount), 0)
  const digitalBalance = treasury.filter(t => t.type === 'digital').reduce((sum, t) => sum + Number(t.amount), 0)

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
                <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '2px 0 0 0' }}>Session Total: ${sessionTotalRevenue.toFixed(2)} ({sessionSales.length} sales)</p>
              </div>
              {sessionSales.length > 0 && (
                <button onClick={handleCompleteReconciliation} style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Reconcile Night
                </button>
              )}
            </div>

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
              <button onClick={() => setShowAddMerch(!showAddMerch)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {showAddMerch ? 'Cancel' : '+ Add Item'}
              </button>
            </div>

            {showAddMerch && (
              <form onSubmit={handleAddMerchItem} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
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
                    <p style={{ fontSize: '11px', color: '#A1A1AA', margin: '0 0 6px 0' }}>Initial Stock per Size:</p>
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

                <button type="submit" style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save Item</button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => updateStock(item.id, -1)} style={{ background: '#27272A', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}><Minus size={12} /></button>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', minWidth: '20px', textAlign: 'center' }}>{stock}</span>
                    <button onClick={() => updateStock(item.id, 1)} style={{ background: '#27272A', color: '#fff', border: 'none', width: '28px', height: '28px', borderRadius: '4px', cursor: 'pointer' }}><Plus size={12} /></button>
                    <button onClick={() => deleteMerch(item.id)} style={{ background: 'none', border: 'none', color: '#EF4444', marginLeft: '6px', cursor: 'pointer' }}><Trash2 size={14} /></button>
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
              <button onClick={() => setShowAddSetlist(!showAddSetlist)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {showAddSetlist ? 'Cancel' : '+ New Setlist'}
              </button>
            </div>

            {showAddSetlist && (
              <form onSubmit={handleSaveSetlist} style={{ background: '#18181B', padding: '12px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '14px' }}>
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
                  <ol style={{ paddingLeft: '20px', fontSize: '13px', color: '#D4D4D8', marginBottom: '10px' }}>
                    {currentSongs.map((s, idx) => <li key={idx}>{s}</li>)}
                  </ol>
                )}
                <button type="submit" style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save Setlist</button>
              </form>
            )}

            {setlists.map(list => (
              <div key={list.id} style={{ background: '#18181B', padding: '14px', borderRadius: '8px', border: '1px solid #27272A', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{list.title}</h3>
                    <p style={{ fontSize: '12px', color: '#A1A1AA', margin: '2px 0 6px 0' }}>{list.venue} • {list.show_date}</p>
                  </div>
                  <button onClick={() => deleteSetlist(list.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#D4D4D8' }}>
                  {list.songs.map((song, i) => <li key={i} style={{ padding: '2px 0' }}>{song}</li>)}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Cart: </span>
              <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#22C55E' }}>${cart.reduce((s, i) => s + (i.price * i.qty), 0).toFixed(2)}</span>
            </div>
            <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '12px', cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleCheckout('Cash')} style={{ flex: 1, background: '#16A34A', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>💵 CASH</button>
            <button onClick={() => handleCheckout('Card')} style={{ flex: 1, background: '#2563EB', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>💳 CARD</button>
            <button onClick={() => handleCheckout('Digital')} style={{ flex: 1, background: '#9333EA', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}>📱 DIGITAL</button>
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