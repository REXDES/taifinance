import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, X, MessageCircle, Paperclip, AtSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskAttachments } from '@/components/task/TaskAttachments';
import { Comment, User, Task } from '@/types';
import { cn } from '@/lib/utils';

interface TaskChatProps {
  task: Task;
  comments: Comment[];
  users: User[];
  currentUserId: string;
  onAddComment: (taskId: string, content: string, mentionedUserIds?: string[]) => void;
  onClose: () => void;
  defaultTab?: 'comments' | 'attachments';
}

export function TaskChat({ task, comments, users, currentUserId, onAddComment, onClose, defaultTab = 'comments' }: TaskChatProps) {
  const [newComment, setNewComment] = useState('');
  const [mentionedUsers, setMentionedUsers] = useState<string[]>([]);
  const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(task.id, newComment.trim(), mentionedUsers.length > 0 ? mentionedUsers : undefined);
      setNewComment('');
      setMentionedUsers([]);
    }
  };

  const toggleUserMention = (userId: string) => {
    setMentionedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const taskComments = comments.filter(c => c.taskId === task.id);

  // Filter out current user from mention list
  const mentionableUsers = users.filter(u => u.id !== currentUserId);

  return (
    <div className="w-96 h-full bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: `hsl(${task.color})` }}
          />
          <h3 className="font-medium text-sm text-foreground truncate max-w-[250px]">
            {task.name}
          </h3>
        </div>
        <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="comments" className="gap-1">
            <MessageCircle className="w-4 h-4" />
            Comentários
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-1">
            <Paperclip className="w-4 h-4" />
            Anexos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="flex-1 flex flex-col mt-0 data-[state=active]:flex">
          {/* Comments */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {taskComments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum comentário ainda. Seja o primeiro!
                </p>
              ) : (
                taskComments.map(comment => {
                  const user = users.find(u => u.id === comment.userId);
                  const isCurrentUser = comment.userId === currentUserId;
                  
                  return (
                    <div key={comment.id} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {user?.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="bg-muted/50 rounded-lg px-3 py-2">
                            <p className="text-sm text-foreground">{comment.content}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 px-1">
                            <span className="text-xs text-muted-foreground">
                              {user?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            {/* Mentioned users display */}
            {mentionedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {mentionedUsers.map(userId => {
                  const user = users.find(u => u.id === userId);
                  return (
                    <span 
                      key={userId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                    >
                      @{user?.name}
                      <button 
                        onClick={() => toggleUserMention(userId)}
                        className="hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escreva um comentário..."
                className="min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            </div>
            <div className="flex gap-2 mt-2">
              <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className={cn(
                      "flex-shrink-0",
                      mentionedUsers.length > 0 && "border-primary text-primary"
                    )}
                    title="Mencionar usuário"
                  >
                    <AtSign className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs text-muted-foreground mb-2 px-2">
                    Selecione usuários para notificar:
                  </p>
                  <div className="space-y-1">
                    {mentionableUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum usuário disponível
                      </p>
                    ) : (
                      mentionableUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => toggleUserMention(user.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                            mentionedUsers.includes(user.id)
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          )}
                        >
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs bg-muted">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm flex-1 truncate">{user.name}</span>
                          {mentionedUsers.includes(user.id) && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button 
                onClick={handleSubmit} 
                className="flex-1"
                disabled={!newComment.trim()}
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attachments" className="flex-1 flex flex-col mt-0 data-[state=active]:flex">
          <ScrollArea className="flex-1 p-4">
            <TaskAttachments taskId={task.id} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
