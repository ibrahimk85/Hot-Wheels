'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  relatedModels?: Array<{ id: number; name: string }>;
}

const STORAGE_KEY = 'ai_chatbot_messages';
const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'Merhaba! Hot Wheels koleksiyonunuz hakkında size nasıl yardımcı olabilirim?',
};

export function AIChatbot() {
  // localStorage'dan mesajları yükle
  const loadMessages = useCallback((): Message[] => {
    if (typeof window === 'undefined') return [INITIAL_MESSAGE];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [INITIAL_MESSAGE];
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
    }
    return [INITIAL_MESSAGE];
  }, []);

  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mesajları localStorage'a kaydet
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving messages to localStorage:', error);
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Önceki isteği iptal et
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Kullanıcı mesajını ekle
    const userMsg: Message = { role: 'user', content: userMessage };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Yeni AbortController oluştur
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // History'yi hazırla - yeni eklenen mesajı dahil etme
    const currentHistory = messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Retry mekanizması
    const maxRetries = 2;
    let lastError: Error | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Timeout ile fetch (30 saniye)
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, 30000);

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            history: currentHistory, // Düzeltilmiş history
          }),
          signal: abortController.signal,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (abortController.signal.aborted) {
          throw new Error('İstek iptal edildi');
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Chatbot yanıt veremedi');
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // Başarılı yanıt - mesajı ekle
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || 'Yanıt alınamadı',
            relatedModels: data.relatedModels,
          },
        ]);
        
        setLoading(false);
        abortControllerRef.current = null;
        return; // Başarılı, döngüden çık

      } catch (error: any) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        lastError = error;

        // Abort edildiyse veya son denemeyse hata göster
        if (abortController.signal.aborted || attempt === maxRetries) {
          let errorMessage = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
          
          if (error.name === 'AbortError' || abortController.signal.aborted) {
            errorMessage = 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
          } else if (error.message) {
            errorMessage = `Hata: ${error.message}`;
          }

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: errorMessage,
            },
          ]);
          setLoading(false);
          abortControllerRef.current = null;
          return;
        }

        // Retry için bekle (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearMessages = () => {
    if (loading) return; // Yükleme sırasında temizleme yapma
    
    // İstek varsa iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    const clearedMessages = [INITIAL_MESSAGE];
    setMessages(clearedMessages);
    
    // localStorage'ı da temizle
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clearedMessages));
      } catch (error) {
        console.error('Error clearing messages from localStorage:', error);
      }
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Asistan
          </CardTitle>
          {messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearMessages}
              disabled={loading}
              className="h-8 w-8 p-0"
              title="Sohbeti Temizle"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.relatedModels && message.relatedModels.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium mb-1">İlgili Modeller:</p>
                      <div className="space-y-1">
                        {message.relatedModels.map((model) => (
                          <Link
                            key={model.id}
                            href={`/model/${model.id}`}
                            className="block text-xs underline hover:no-underline"
                          >
                            {model.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">Düşünüyor...</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Mesajınızı yazın..."
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}




