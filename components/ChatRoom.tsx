
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, updateGroup, updateMessage } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { Send, User as UserIcon, MessageSquare, Lock, Users, Plus, ListTodo, Paperclip, CheckSquare, Square, Download, X, Trash2, Eye, Reply, Info, Camera, Edit2, ArrowRight, Mic, Smile, StopCircle, Check, Phone, Video, PhoneIncoming, FileText, CheckCheck, Play, Pause, Loader2 } from 'lucide-react';

interface ChatRoomProps { 
    currentUser: User; 
    preloadedMessages: ChatMessage[]; 
    onRefresh: () => void; 
}
const LAST_READ_KEY = 'chat_last_read_map';

const COMMON_EMOJIS = [
    "👍", "❤️", "😂", "😮", "😢", "😡", "🙏", "🤝", "✅", "👀",
    "😊", "😎", "🤔", "🎉", "🔥", "💯", "👋", "💪", "💐", "🚀"
];

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(preloadedMessages || []);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [tasks, setTasks] = useState<GroupTask[]>([]);
    const [inputText, setInputText] = useState('');
    const [activeChannel, setActiveChannel] = useState<{type: 'public' | 'private' | 'group', id: string | null}>({ type: 'public', id: null });
    const activeChannelRef = useRef(activeChannel);
    const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat'); 
    
    // Group Modal State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
    
    // Tasks State
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    
    // Upload & Input State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showTagList, setShowTagList] = useState(false);
    const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reply & Edit
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    // Group Info
    const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [uploadingGroupIcon, setUploadingGroupIcon] = useState(false);
    const groupIconInputRef = useRef<HTMLInputElement>(null);
    
    // Voice Recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const recordingInterval = useRef<any>(null);
    
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);

    useEffect(() => { try { const stored = localStorage.getItem(LAST_READ_KEY); if (stored) setLastReadMap(JSON.parse(stored)); } catch (e) { console.error("Failed to load read history"); } }, []);
    
    useEffect(() => { if (preloadedMessages) setMessages(preloadedMessages); }, [preloadedMessages]);

    useEffect(() => { 
        activeChannelRef.current = activeChannel; 
        const key = getChannelKey(activeChannel.type, activeChannel.id); 
        updateLastRead(key); 
        setReplyingTo(null); 
        setEditingMessageId(null); 
        setInputText(''); 
        setMobileShowChat(true); // On mobile, if channel changes, show chat view
    }, [activeChannel.id, activeChannel.type]); // Fix dependency

    const updateLastRead = (key: string) => { 
        setLastReadMap(prev => { 
            const next = { ...prev, [key]: Date.now() }; 
            localStorage.setItem(LAST_READ_KEY, JSON.stringify(next)); 
            return next; 
        }); 
    };
    
    const getChannelKey = (type: 'public' | 'private' | 'group', id: string | null) => { if (type === 'public') return 'public'; return `${type}_${id}`; };

    const loadMeta = async () => {
        try {
            const usrList = await getUsers(); setUsers(usrList.filter(u => u.username !== currentUser.username));
            const grpList = await getGroups(); const isManager = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole); setGroups(grpList.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username));
            const tskList = await getTasks(); setTasks(tskList);
        } catch (e) { console.error("Chat meta load error", e); }
    };

    useEffect(() => { 
        loadMeta(); 
        const interval = setInterval(loadMeta, 10000); 
        return () => clearInterval(interval); 
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeChannel, replyingTo, mobileShowChat]);

    const handleSend = async (e: React.FormEvent | null, attachment?: {fileName: string, url: string}, audioUrl?: string, customText?: string) => {
        if (e) e.preventDefault();
        const msgText = customText || inputText;
        
        if (!msgText.trim() && !attachment && !audioUrl) return;

        if (editingMessageId && !customText && !attachment && !audioUrl) { 
            const msgToUpdate = messages.find(m => m.id === editingMessageId);
            if (msgToUpdate) {
                const updatedMsg = { ...msgToUpdate, message: msgText, isEdited: true };
                await updateMessage(updatedMsg);
                setEditingMessageId(null);
            }
        } else {
            const newMsg: ChatMessage = { 
                id: generateUUID(), 
                sender: currentUser.fullName, 
                senderUsername: currentUser.username, 
                role: currentUser.role, 
                message: msgText, 
                timestamp: Date.now(), 
                recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined, 
                groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined, 
                attachment: attachment,
                audioUrl: audioUrl,
                replyTo: replyingTo ? {
                    id: replyingTo.id,
                    sender: replyingTo.sender,
                    message: replyingTo.message || (replyingTo.audioUrl ? 'پیام صوتی' : replyingTo.attachment ? 'فایل ضمیمه' : '...')
                } : undefined
            };
            await sendMessage(newMsg);
        }
        
        if (!customText) setInputText(''); 
        setShowTagList(false); 
        setReplyingTo(null); 
        const key = getChannelKey(activeChannel.type, activeChannel.id); 
        updateLastRead(key); 
        onRefresh(); 
    };

    // --- Actions ---
    const handleDeleteMessage = async (id: string) => { if (confirm("حذف پیام؟")) { await deleteMessage(id); onRefresh(); } };
    const handleEditMessage = (msg: ChatMessage) => { setEditingMessageId(msg.id); setInputText(msg.message); inputRef.current?.focus(); };
    
    // Improved File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0]; 
        if (!file) return; 
        
        setIsUploading(true); 
        const reader = new FileReader(); 
        
        reader.onload = async (ev) => { 
            const base64 = ev.target?.result as string; 
            try { 
                const result = await uploadFile(file.name, base64); 
                await handleSend(null, { fileName: result.fileName, url: result.url }); 
            } catch (error) { 
                alert('خطا در ارسال فایل. اتصال اینترنت را بررسی کنید.'); 
            } finally { 
                setIsUploading(false); 
            } 
        }; 
        
        reader.onerror = () => {
            alert("خطا در خواندن فایل");
            setIsUploading(false);
        };

        reader.readAsDataURL(file); 
        e.target.value = ''; 
    };

    // Improved Voice Recording
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            setMediaRecorder(recorder);
            const chunks: BlobPart[] = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                // Stop tracks to release mic
                stream.getTracks().forEach(track => track.stop());
                
                const blob = new Blob(chunks, { type: 'audio/webm' }); // Use webm for broad support
                setIsUploading(true);
                
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    try {
                        const fileName = `voice_${Date.now()}.webm`;
                        const result = await uploadFile(fileName, base64);
                        await handleSend(null, undefined, result.url);
                    } catch (e) {
                        alert("خطا در ارسال پیام صوتی");
                    } finally {
                        setIsUploading(false);
                    }
                };
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingInterval.current = setInterval(() => setRecordingTime(p => p + 1), 1000);

        } catch (err) {
            console.error("Mic Error:", err);
            alert("دسترسی به میکروفون امکان‌پذیر نیست. لطفاً مجوزها را بررسی کنید.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            setIsRecording(false);
            if (recordingInterval.current) clearInterval(recordingInterval.current);
            setMediaRecorder(null);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Render Logic
    const displayedMessages = messages.filter(msg => { 
        if (activeChannel.type === 'public') return !msg.recipient && !msg.groupId; 
        if (activeChannel.type === 'private') return (msg.senderUsername === activeChannel.id && msg.recipient === currentUser.username) || (msg.senderUsername === currentUser.username && msg.recipient === activeChannel.id); 
        if (activeChannel.type === 'group') return msg.groupId === activeChannel.id; 
        return false; 
    });

    const getUnreadCount = (type: 'public' | 'private' | 'group', id: string | null) => { 
        const key = getChannelKey(type, id); 
        const lastRead = lastReadMap[key] || 0; 
        return messages.filter(msg => { 
            if (msg.timestamp <= lastRead) return false; 
            if (msg.senderUsername === currentUser.username) return false; 
            if (type === 'public') return !msg.recipient && !msg.groupId; 
            if (type === 'group') return msg.groupId === id; 
            if (type === 'private') return (msg.senderUsername === id && msg.recipient === currentUser.username); 
            return false; 
        }).length; 
    };

    return (
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] bg-gray-100 overflow-hidden relative">
            
            {/* --- SIDEBAR (Contact List) --- */}
            <div className={`w-full md:w-80 bg-white border-l border-gray-200 flex flex-col absolute md:relative z-20 h-full transition-transform duration-300 ${mobileShowChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">{currentUser.fullName.charAt(0)}</div>
                        <span className="font-bold text-gray-700">گفتگوها</span>
                    </div>
                    <button onClick={() => setShowGroupModal(true)} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 text-blue-600"><Edit2 size={18}/></button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {/* Public Channel */}
                    <div 
                        onClick={() => { setActiveChannel({type: 'public', id: null}); setMobileShowChat(true); }}
                        className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${activeChannel.type === 'public' ? 'bg-blue-50' : ''}`}
                    >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center text-white"><Users size={24}/></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-gray-800 text-sm">کانال عمومی</span>
                                {getUnreadCount('public', null) > 0 && <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">{getUnreadCount('public', null)}</span>}
                            </div>
                            <p className="text-xs text-gray-500 truncate">پیام‌های عمومی سیستم...</p>
                        </div>
                    </div>

                    {/* Groups */}
                    {groups.map(g => (
                        <div key={g.id} 
                            onClick={() => { setActiveChannel({type: 'group', id: g.id}); setMobileShowChat(true); }}
                            className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${activeChannel.type === 'group' && activeChannel.id === g.id ? 'bg-blue-50' : ''}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                                {g.icon ? <img src={g.icon} className="w-full h-full object-cover"/> : <ListTodo className="text-indigo-500"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-gray-800 text-sm truncate">{g.name}</span>
                                    {getUnreadCount('group', g.id) > 0 && <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">{getUnreadCount('group', g.id)}</span>}
                                </div>
                                <p className="text-xs text-gray-500 truncate">گروه کاری</p>
                            </div>
                        </div>
                    ))}

                    {/* Private Chats */}
                    {users.map(u => (
                        <div key={u.id} 
                            onClick={() => { setActiveChannel({type: 'private', id: u.username}); setMobileShowChat(true); }}
                            className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 ${activeChannel.type === 'private' && activeChannel.id === u.username ? 'bg-blue-50' : ''}`}
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : <UserIcon className="text-gray-500"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold text-gray-800 text-sm truncate">{u.fullName}</span>
                                    {getUnreadCount('private', u.username) > 0 && <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full">{getUnreadCount('private', u.username)}</span>}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{u.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- MAIN CHAT AREA --- */}
            <div className={`flex-1 flex flex-col bg-[#8e98a3] relative h-full transition-transform duration-300 w-full md:w-auto absolute md:static z-30 ${mobileShowChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                
                {/* Chat Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>

                {/* Chat Header */}
                <div className="bg-white p-3 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileShowChat(false)} className="md:hidden p-1 text-gray-500"><ArrowRight/></button>
                        <div className="flex flex-col">
                            <h3 className="font-bold text-gray-800">
                                {activeChannel.type === 'public' ? 'کانال عمومی' : activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : groups.find(g=>g.id===activeChannel.id)?.name}
                            </h3>
                            <span className="text-xs text-blue-500 font-medium">آنلاین</span>
                        </div>
                    </div>
                    {/* Header Actions */}
                    <div className="flex gap-3">
                        {activeChannel.type === 'group' && <button className="text-gray-500" onClick={()=>setActiveTab(activeTab==='chat'?'tasks':'chat')}>{activeTab==='chat' ? <ListTodo/> : <MessageSquare/>}</button>}
                    </div>
                </div>

                {/* Messages List */}
                {activeTab === 'chat' ? (
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative z-0">
                        {displayedMessages.map((msg) => {
                            const isMe = msg.senderUsername === currentUser.username;
                            return (
                                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 relative shadow-sm text-sm group ${isMe ? 'bg-[#eeffde] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                        
                                        {/* Reply Context */}
                                        {msg.replyTo && (
                                            <div className="border-l-2 border-blue-500 pl-2 mb-1 cursor-pointer" onClick={() => {
                                                const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                                                el?.scrollIntoView({behavior: 'smooth', block: 'center'});
                                            }}>
                                                <div className="text-[10px] font-bold text-blue-600">{msg.replyTo.sender}</div>
                                                <div className="text-[10px] text-gray-500 truncate">{msg.replyTo.message}</div>
                                            </div>
                                        )}

                                        {/* Sender Name (if group) */}
                                        {!isMe && activeChannel.type !== 'private' && (
                                            <div className="text-[10px] font-bold text-blue-600 mb-0.5">{msg.sender}</div>
                                        )}

                                        {/* Content */}
                                        {msg.audioUrl ? (
                                            <div className="flex items-center gap-2 min-w-[150px]">
                                                <div className="bg-blue-500 rounded-full p-2 text-white">
                                                    <Play size={14} fill="currentColor"/>
                                                </div>
                                                <audio controls className="h-8 w-40" src={msg.audioUrl} />
                                            </div>
                                        ) : msg.attachment ? (
                                            <div className="flex items-center gap-2 bg-black/5 p-2 rounded-lg min-w-[150px]">
                                                <div className="bg-blue-500 rounded-full p-2 text-white"><FileText size={16}/></div>
                                                <div className="overflow-hidden">
                                                    <div className="text-xs font-bold truncate w-32">{msg.attachment.fileName}</div>
                                                    <a href={msg.attachment.url} target="_blank" className="text-[10px] text-blue-600">دانلود فایل</a>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                                        )}

                                        {/* Metadata Footer */}
                                        <div className="flex justify-end items-center gap-1 mt-1 opacity-60">
                                            {msg.isEdited && <span className="text-[9px]">ویرایش شده</span>}
                                            <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                            {isMe && <CheckCheck size={12} className="text-blue-500"/>}
                                        </div>

                                        {/* Context Menu (Hidden by default, shown on hover/long press) */}
                                        <div className="absolute top-0 right-0 bg-white shadow-lg rounded-lg p-1 hidden group-hover:flex z-10 -mt-8">
                                            <button onClick={() => setReplyingTo(msg)} className="p-1 hover:bg-gray-100 rounded text-gray-600"><Reply size={14}/></button>
                                            {isMe && <button onClick={() => handleEditMessage(msg)} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Edit2 size={14}/></button>}
                                            {(isMe || currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 size={14}/></button>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    // Task Mode UI
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                        <div className="flex gap-2 mb-4">
                            <input className="flex-1 p-2 border rounded-lg text-sm" placeholder="تسک جدید..." value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} />
                            <button onClick={async ()=>{ 
                                if(!newTaskTitle) return;
                                await createTask({ id: generateUUID(), groupId: activeChannel.id!, title: newTaskTitle, isCompleted: false, createdBy: currentUser.username, createdAt: Date.now() });
                                setNewTaskTitle(''); loadMeta();
                            }} className="bg-blue-600 text-white px-4 rounded-lg text-sm">افزودن</button>
                        </div>
                        {tasks.filter(t => t.groupId === activeChannel.id).map(t => (
                            <div key={t.id} className="bg-white p-3 rounded-xl shadow-sm flex items-center gap-3">
                                <button onClick={async ()=>{ await updateTask({...t, isCompleted: !t.isCompleted}); loadMeta(); }}>
                                    {t.isCompleted ? <CheckSquare className="text-green-500"/> : <Square className="text-gray-400"/>}
                                </button>
                                <span className={`flex-1 text-sm ${t.isCompleted ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                                <button onClick={async ()=>{ if(confirm('حذف؟')) { await deleteTask(t.id); loadMeta(); } }} className="text-red-400"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                {activeTab === 'chat' && (
                    <div className="p-2 bg-white flex items-end gap-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-20">
                        {/* Reply Context Bar */}
                        {replyingTo && (
                            <div className="absolute bottom-full left-0 right-0 bg-white border-b p-2 flex justify-between items-center border-t border-gray-100">
                                <div className="flex items-center gap-2 text-sm border-l-2 border-blue-500 pl-2">
                                    <Reply size={16} className="text-blue-500"/>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-blue-600 text-xs">{replyingTo.sender}</span>
                                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{replyingTo.message || 'فایل'}</span>
                                    </div>
                                </div>
                                <button onClick={() => setReplyingTo(null)}><X size={16}/></button>
                            </div>
                        )}

                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-blue-600 transition-colors">
                            {isUploading ? <Loader2 size={24} className="animate-spin"/> : <Paperclip size={24}/>}
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>

                        <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2 min-h-[48px]">
                            <textarea 
                                ref={inputRef as any}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                                placeholder="پیام..."
                                className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32"
                                rows={1}
                                style={{ height: 'auto', minHeight: '24px' }}
                            />
                        </div>

                        {inputText.trim() || isUploading ? (
                            <button onClick={(e) => handleSend(e)} className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-transform active:scale-90">
                                <Send size={20} className={document.dir === 'rtl' ? 'rotate-180' : ''}/>
                            </button>
                        ) : (
                            <button 
                                onMouseDown={handleStartRecording} 
                                onMouseUp={handleStopRecording}
                                onTouchStart={handleStartRecording}
                                onTouchEnd={handleStopRecording}
                                className={`p-3 rounded-full shadow-lg transition-all ${isRecording ? 'bg-red-500 scale-110' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                            >
                                {isRecording ? <div className="flex items-center gap-1"><div className="w-2 h-2 bg-white rounded-full animate-ping"/> <span className="text-xs">{formatTime(recordingTime)}</span></div> : <Mic size={20}/>}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for Group Creation */}
            {showGroupModal && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                        <h3 className="font-bold mb-4">ایجاد گروه جدید</h3>
                        <input className="w-full border rounded p-2 mb-4" placeholder="نام گروه" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                        <div className="max-h-48 overflow-y-auto mb-4 border rounded p-2">
                            {users.map(u => (
                                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                                    <input type="checkbox" onChange={e => {
                                        if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, u.username]);
                                        else setSelectedGroupMembers(selectedGroupMembers.filter(m => m !== u.username));
                                    }}/>
                                    <span>{u.fullName}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowGroupModal(false)} className="px-4 py-2 text-gray-600">لغو</button>
                            <button onClick={async () => {
                                if(!newGroupName) return;
                                await createGroup({ id: generateUUID(), name: newGroupName, members: [...selectedGroupMembers, currentUser.username], createdBy: currentUser.username });
                                setShowGroupModal(false); loadMeta();
                            }} className="px-4 py-2 bg-blue-600 text-white rounded">ایجاد</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ChatRoom;
