
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, updateGroup, updateMessage } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { 
    Send, User as UserIcon, MessageSquare, Users, Plus, ListTodo, Paperclip, 
    CheckSquare, Square, X, Trash2, Reply, Edit2, ArrowRight, Mic, 
    Play, Pause, Loader2, Search, MoreVertical, File, Image as ImageIcon,
    Check, CheckCheck, DownloadCloud, StopCircle
} from 'lucide-react';

interface ChatRoomProps { 
    currentUser: User; 
    preloadedMessages: ChatMessage[]; 
    onRefresh: () => void; 
}

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh }) => {
    // --- Data State ---
    const [messages, setMessages] = useState<ChatMessage[]>(preloadedMessages || []);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [tasks, setTasks] = useState<GroupTask[]>([]);
    
    // --- UI State ---
    const [activeChannel, setActiveChannel] = useState<{type: 'public' | 'private' | 'group', id: string | null}>({ type: 'public', id: null });
    const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat'); 
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Input & Action State ---
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // --- Voice Recording State ---
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);

    // --- Modal State ---
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    // --- Load Data & Effects ---
    useEffect(() => { if (preloadedMessages) setMessages(preloadedMessages); }, [preloadedMessages]);

    useEffect(() => { 
        loadMeta();
        const interval = setInterval(loadMeta, 5000); // Polling for new data
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        scrollToBottom();
        // Reset inputs on channel change
        setReplyingTo(null);
        setEditingMessageId(null);
        setInputText('');
    }, [activeChannel, messages.length, mobileShowChat]);

    const loadMeta = async () => {
        try {
            const usrList = await getUsers();
            setUsers(usrList.filter(u => u.username !== currentUser.username));
            
            const grpList = await getGroups();
            const isManager = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole);
            const visibleGroups = grpList.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username);
            setGroups(visibleGroups);
            
            const tskList = await getTasks();
            setTasks(tskList);
        } catch (e) { console.error("Chat load error", e); }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const getDisplayMessages = () => {
        return messages.filter(msg => { 
            if (activeChannel.type === 'public') return !msg.recipient && !msg.groupId; 
            if (activeChannel.type === 'private') return (msg.senderUsername === activeChannel.id && msg.recipient === currentUser.username) || (msg.senderUsername === currentUser.username && msg.recipient === activeChannel.id); 
            if (activeChannel.type === 'group') return msg.groupId === activeChannel.id; 
            return false; 
        });
    };

    // --- Action Handlers ---

    const handleSendMessage = async () => {
        if ((!inputText.trim()) || isUploading) return;

        if (editingMessageId) {
            const msgToUpdate = messages.find(m => m.id === editingMessageId);
            if (msgToUpdate) {
                await updateMessage({ ...msgToUpdate, message: inputText, isEdited: true });
                setEditingMessageId(null);
                setInputText('');
                onRefresh();
            }
            return;
        }

        const newMsg: ChatMessage = {
            id: generateUUID(),
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: inputText,
            timestamp: Date.now(),
            recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
            groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender,
                message: replyingTo.message || (replyingTo.audioUrl ? 'پیام صوتی' : 'فایل')
            } : undefined
        };

        await sendMessage(newMsg);
        setInputText('');
        setReplyingTo(null);
        onRefresh();
        scrollToBottom();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024 * 1024) {
            alert('حجم فایل نباید بیشتر از ۱ گیگابایت باشد.');
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        
        reader.onload = async (ev) => {
            try {
                const base64 = ev.target?.result as string;
                // Upload returns { fileName, url }
                const result = await uploadFile(file.name, base64);
                
                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: '',
                    timestamp: Date.now(),
                    recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
                    groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
                    attachment: { fileName: result.fileName, url: result.url }
                };
                await sendMessage(newMsg);
                onRefresh();
            } catch (error) {
                console.error("File Upload Error:", error);
                alert('خطا در ارسال فایل. لطفاً اتصال اینترنت را بررسی کنید.');
            } finally {
                setIsUploading(false);
            }
        };

        reader.onerror = () => {
             alert("خطا در خواندن فایل.");
             setIsUploading(false);
        };

        try {
            reader.readAsDataURL(file);
        } catch(e) {
            alert("خطا در پردازش فایل.");
            setIsUploading(false);
        }

        e.target.value = '';
    };

    // --- Voice Recording Logic ---
    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                clearInterval(recordingTimerRef.current);
            }
        } else {
            // Check for Secure Context
            if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
                alert("امکان ضبط صدا فقط در حالت امن (HTTPS) یا لوکال‌هاست وجود دارد. لطفاً از سرور HTTPS استفاده کنید.");
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (audioBlob.size < 1000) { setIsUploading(false); return; }

                    setIsUploading(true);
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                            const result = await uploadFile(`voice_${Date.now()}.webm`, base64);
                            const newMsg: ChatMessage = {
                                id: generateUUID(),
                                sender: currentUser.fullName,
                                senderUsername: currentUser.username,
                                role: currentUser.role,
                                message: '',
                                timestamp: Date.now(),
                                recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
                                groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
                                audioUrl: result.url
                            };
                            await sendMessage(newMsg);
                            onRefresh();
                        } catch (e) {
                            console.error("Voice Upload Error:", e);
                            alert('خطا در ارسال ویس');
                        } finally {
                            setIsUploading(false);
                        }
                    };
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsRecording(true);
                setRecordingTime(0);
                recordingTimerRef.current = setInterval(() => {
                    setRecordingTime(prev => prev + 1);
                }, 1000);

            } catch (err) {
                console.error("Mic error:", err);
                alert("دسترسی به میکروفون امکان‌پذیر نیست.");
                setIsRecording(false);
            }
        }
    };

    const handleEditMessage = (msg: ChatMessage) => {
        if (!msg.message) return;
        setInputText(msg.message);
        setEditingMessageId(msg.id);
        setReplyingTo(null);
        inputAreaRef.current?.focus();
    };

    const handleDeleteMessage = async (id: string) => {
        if (confirm("آیا از حذف این پیام اطمینان دارید؟")) {
            await deleteMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
            onRefresh();
        }
    };

    // --- Render Logic ---
    const filteredUsers = users.filter(u => u.fullName.includes(searchTerm));
    const filteredGroups = groups.filter(g => g.name.includes(searchTerm));

    return (
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm relative">
            
            {/* --- SIDEBAR --- */}
            <div className={`absolute inset-0 md:static md:w-80 bg-white border-l border-gray-200 flex flex-col z-20 transition-transform duration-300 ${mobileShowChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Sidebar Header */}
                <div className="p-3 border-b flex flex-col gap-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
                                {currentUser.fullName.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800">پیام‌رسان</span>
                        </div>
                        <button onClick={() => setShowGroupModal(true)} className="p-2 text-blue-600 bg-white rounded-full hover:bg-blue-50 shadow-sm transition-colors">
                            <Edit2 size={18}/>
                        </button>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search size={16} className="absolute right-3 top-2.5 text-gray-400"/>
                        <input 
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 pr-9 pl-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none" 
                            placeholder="جستجو..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Public Channel */}
                    <div 
                        onClick={() => { setActiveChannel({type: 'public', id: null}); setMobileShowChat(true); }}
                        className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${activeChannel.type === 'public' ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                            <Users size={22}/>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-gray-800 text-sm">کانال عمومی</span>
                                <span className="text-[10px] text-gray-400">همیشه</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">پیام‌های عمومی سیستم...</p>
                        </div>
                    </div>

                    {/* Groups */}
                    {filteredGroups.map(g => (
                        <div key={g.id} 
                            onClick={() => { setActiveChannel({type: 'group', id: g.id}); setMobileShowChat(true); }}
                            className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${activeChannel.type === 'group' && activeChannel.id === g.id ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold border border-orange-200">
                                {g.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-gray-800 text-sm truncate">{g.name}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">گروه کاری</p>
                            </div>
                        </div>
                    ))}

                    {/* Users */}
                    {filteredUsers.map(u => (
                        <div key={u.id} 
                            onClick={() => { setActiveChannel({type: 'private', id: u.username}); setMobileShowChat(true); }}
                            className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors ${activeChannel.type === 'private' && activeChannel.id === u.username ? 'bg-blue-50 border-r-4 border-blue-600' : ''}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : <UserIcon className="text-gray-500"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-gray-800 text-sm truncate">{u.fullName}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">{u.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CHAT AREA --- */}
            <div className={`absolute inset-0 md:static flex-1 min-w-0 flex flex-col bg-[#8E98A3] z-30 transition-transform duration-300 ${mobileShowChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" 
                     style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}>
                </div>

                {/* Header */}
                <div className="bg-white p-3 flex justify-between items-center shadow-sm z-10 sticky top-0 cursor-pointer" onClick={() => { if(activeChannel.type==='group') setActiveTab(activeTab==='chat'?'tasks':'chat') }}>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileShowChat(false)} className="md:hidden p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowRight/></button>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-gray-800 text-base">
                                {activeChannel.type === 'public' ? 'کانال عمومی' : activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : groups.find(g=>g.id===activeChannel.id)?.name}
                            </h3>
                            <span className="text-xs text-blue-500 font-medium">
                                {activeChannel.type === 'group' ? (activeTab === 'chat' ? 'بزنید برای تسک‌ها' : 'بزنید برای چت') : 'آنلاین'}
                            </span>
                        </div>
                    </div>
                    {activeChannel.type === 'group' && (
                        <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                            {activeTab === 'chat' ? <ListTodo size={20}/> : <MessageSquare size={20}/>}
                        </div>
                    )}
                </div>

                {/* Messages - Added pb-20 to ensure last message is visible above input */}
                {activeTab === 'chat' ? (
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative z-0 overflow-x-hidden pb-20">
                        {getDisplayMessages().map((msg) => {
                            const isMe = msg.senderUsername === currentUser.username;
                            return (
                                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-1 group`}>
                                    {/* Added max-w constraints to prevent overflow */}
                                    <div className={`relative max-w-[85%] md:max-w-[75%] lg:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm text-sm ${isMe ? 'bg-[#EEFFDE] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                        
                                        {/* Reply Context */}
                                        {msg.replyTo && (
                                            <div className={`mb-1 px-2 py-1 rounded border-r-2 text-xs cursor-pointer ${isMe ? 'bg-[#dcf8c6] border-green-500' : 'bg-gray-50 border-blue-500'}`} onClick={() => {
                                                document.getElementById(`msg-${msg.replyTo?.id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
                                            }}>
                                                <div className="font-bold text-blue-600 opacity-80">{msg.replyTo.sender}</div>
                                                <div className="truncate opacity-70">{msg.replyTo.message}</div>
                                            </div>
                                        )}

                                        {/* Sender Name (In Group) */}
                                        {!isMe && activeChannel.type !== 'private' && (
                                            <div className="text-[11px] font-bold text-orange-600 mb-1">{msg.sender}</div>
                                        )}

                                        {/* Content: Voice */}
                                        {msg.audioUrl && (
                                            <div className="flex items-center gap-3 min-w-[160px] py-1">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm ${isMe ? 'bg-green-500' : 'bg-blue-500'}`}>
                                                    <Play size={14} fill="currentColor" className="ml-0.5"/>
                                                </div>
                                                <audio controls src={msg.audioUrl} className="h-8 w-40 opacity-80" />
                                            </div>
                                        )}

                                        {/* Content: File/Image */}
                                        {msg.attachment && (
                                            <div className="mb-1">
                                                {msg.attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <a href={msg.attachment.url} target="_blank" className="block mb-1">
                                                        <img src={msg.attachment.url} alt="attachment" className="max-w-full h-auto rounded-lg max-h-60 object-cover" />
                                                    </a>
                                                ) : (
                                                    <div className="flex items-center gap-3 bg-black/5 p-2 rounded-lg max-w-full overflow-hidden">
                                                        <div className={`p-2 rounded-full text-white shrink-0 ${isMe ? 'bg-green-500' : 'bg-blue-500'}`}><File size={18}/></div>
                                                        <div className="overflow-hidden min-w-0">
                                                            <div className="truncate font-bold text-xs">{msg.attachment.fileName}</div>
                                                            <a href={msg.attachment.url} target="_blank" className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5">دانلود <DownloadCloud size={10}/></a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Content: Text - Added break-words to fix horizontal scrolling */}
                                        {msg.message && <div className="whitespace-pre-wrap leading-relaxed break-words break-all">{msg.message}</div>}

                                        {/* Meta & Actions Row (Inside Bubble) */}
                                        <div className="flex justify-between items-end mt-1 pt-1 border-t border-black/5">
                                            {/* Left: Actions (Always visible/accessible) */}
                                            <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                                <button onClick={() => setReplyingTo(msg)} className="p-0.5 hover:text-blue-600"><Reply size={12}/></button>
                                                {isMe && <button onClick={() => handleEditMessage(msg)} className="p-0.5 hover:text-green-600"><Edit2 size={12}/></button>}
                                                {(isMe || currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteMessage(msg.id)} className="p-0.5 hover:text-red-600"><Trash2 size={12}/></button>}
                                            </div>

                                            {/* Right: Time & Status */}
                                            <div className="flex items-center gap-1 opacity-50 select-none text-[10px]">
                                                {msg.isEdited && <span className="text-[8px]">ویرایش شده</span>}
                                                <span>{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                {isMe && <CheckCheck size={12} className="text-green-600"/>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    // Tasks View
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                            <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-700"><CheckSquare className="text-green-600"/> تسک‌های گروه</h3>
                            <div className="flex gap-2">
                                <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="تسک جدید..." value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)}/>
                                <button onClick={async ()=>{ 
                                    if(!newTaskTitle) return; 
                                    await createTask({ id: generateUUID(), groupId: activeChannel.id!, title: newTaskTitle, isCompleted: false, createdBy: currentUser.username, createdAt: Date.now() }); 
                                    setNewTaskTitle(''); loadMeta(); 
                                }} className="bg-green-600 text-white px-4 rounded-lg font-bold">افزودن</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {tasks.filter(t => t.groupId === activeChannel.id).map(t => (
                                <div key={t.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3">
                                    <button onClick={async ()=>{ await updateTask({...t, isCompleted: !t.isCompleted}); loadMeta(); }} className={t.isCompleted ? "text-green-500" : "text-gray-300"}>
                                        {t.isCompleted ? <CheckSquare/> : <Square/>}
                                    </button>
                                    <span className={`flex-1 text-sm ${t.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
                                    <button onClick={async ()=>{ if(confirm('حذف؟')) { await deleteTask(t.id); loadMeta(); } }} className="text-red-400 p-1"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                {activeTab === 'chat' && (
                    <div className="bg-white p-2 flex items-end gap-2 border-t relative z-20">
                        {/* Reply Preview */}
                        {replyingTo && (
                            <div className="absolute bottom-full left-0 right-0 bg-white border-t border-b p-2 flex justify-between items-center shadow-sm z-10 animate-slide-up">
                                <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-2">
                                    <Reply size={20} className="text-blue-500"/>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-blue-600 text-xs">پاسخ به {replyingTo.sender}</span>
                                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{replyingTo.message || 'رسانه'}</span>
                                    </div>
                                </div>
                                <button onClick={() => { setReplyingTo(null); setEditingMessageId(null); setInputText(''); }} className="p-1 hover:bg-red-50 rounded-full text-gray-500 hover:text-red-500"><X size={18}/></button>
                            </div>
                        )}

                        {/* File Upload */}
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors mb-1">
                            {isUploading ? <Loader2 size={24} className="animate-spin text-blue-500"/> : <Paperclip size={24}/>}
                        </button>

                        {/* Text Input */}
                        <div className="flex-1 bg-gray-100 rounded-3xl flex items-center px-4 py-2 min-h-[48px] border border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all">
                            <textarea 
                                ref={inputAreaRef}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                placeholder={isRecording ? "در حال ضبط (برای پایان ضربه بزنید)..." : "پیام خود را بنویسید..."}
                                className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32"
                                rows={1}
                                style={{ height: 'auto', minHeight: '24px' }}
                                disabled={isRecording}
                            />
                        </div>

                        {/* Mic / Send Button */}
                        {inputText.trim() || isUploading || editingMessageId ? (
                            <button onClick={handleSendMessage} className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-transform active:scale-95 mb-1 animate-scale-in">
                                {editingMessageId ? <Check size={20}/> : <Send size={20} className={document.dir === 'rtl' ? 'rotate-180' : ''}/>}
                            </button>
                        ) : (
                            // TOGGLE RECORDING (Click to Start / Click to Send)
                            <button 
                                onClick={toggleRecording}
                                className={`p-3 rounded-full shadow-lg transition-all mb-1 ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'}`}
                            >
                                {isRecording ? (
                                    <div className="flex items-center justify-center w-5 h-5 relative">
                                        <div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></div>
                                        <div className="z-10"><Send size={20} className={document.dir === 'rtl' ? 'rotate-180 text-white' : 'text-white'}/></div>
                                    </div>
                                ) : <Mic size={20} className="text-white"/>}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for Group Creation */}
            {showGroupModal && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 text-lg">ایجاد گروه جدید</h3>
                            <button onClick={() => setShowGroupModal(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <input className="w-full border rounded-xl p-3 mb-4 bg-gray-50 focus:bg-white transition-colors" placeholder="نام گروه" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                        <div className="max-h-48 overflow-y-auto mb-4 border rounded-xl p-2 bg-gray-50 custom-scrollbar">
                            {users.map(u => (
                                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" onChange={e => {
                                        if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, u.username]);
                                        else setSelectedGroupMembers(selectedGroupMembers.filter(m => m !== u.username));
                                    }}/>
                                    <span className="text-sm font-medium text-gray-700">{u.fullName}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={async () => {
                            if(!newGroupName) return;
                            await createGroup({ id: generateUUID(), name: newGroupName, members: [...selectedGroupMembers, currentUser.username], createdBy: currentUser.username });
                            setShowGroupModal(false); loadMeta();
                        }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">ایجاد گروه</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;
