import { useState, useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ProjectHeader } from '@/components/project/ProjectHeader';
import { ListView } from '@/components/project/ListView';
import { KanbanView } from '@/components/project/KanbanView';
import { GanttView } from '@/components/project/GanttView';
import { TaskChat } from '@/components/chat/TaskChat';
import { HomeView } from '@/components/HomeView';
import { CreateCompanyDialog } from '@/components/dialogs/CreateCompanyDialog';
import { CreateProjectDialog } from '@/components/dialogs/CreateProjectDialog';
import { EditCompanyDialog } from '@/components/dialogs/EditCompanyDialog';
import { DeleteCompanyDialog } from '@/components/dialogs/DeleteCompanyDialog';
import { EditProjectDialog } from '@/components/dialogs/EditProjectDialog';
import { DeleteProjectDialog } from '@/components/dialogs/DeleteProjectDialog';
import { CreateElementDialog } from '@/components/dialogs/CreateElementDialog';
import { EditElementDialog } from '@/components/dialogs/EditElementDialog';
import { DeleteElementDialog } from '@/components/dialogs/DeleteElementDialog';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';
import { ProfileDialog } from '@/components/dialogs/ProfileDialog';
import { UsersDialog } from '@/components/dialogs/UsersDialog';
import { InvitationsDialog } from '@/components/dialogs/InvitationsDialog';
import { StatusConfigDialog } from '@/components/dialogs/StatusConfigDialog';
import { ElementWorkGroupDialog } from '@/components/dialogs/ElementWorkGroupDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanies } from '@/hooks/useCompanies';
import { useProjects } from '@/hooks/useProjects';
import { useElements } from '@/hooks/useElements';
import { useTasks } from '@/hooks/useTasks';
import { useStatuses } from '@/hooks/useStatuses';
import { useUsers } from '@/hooks/useUsers';
import { useNotifications } from '@/hooks/useNotifications';
import { useComments } from '@/hooks/useComments';
import { useElementFavorites } from '@/hooks/useElementFavorites';
import { useMyWork } from '@/hooks/useMyWork';
import { useFavoriteElements } from '@/hooks/useFavoriteElements';
import { usePriorityTasks } from '@/hooks/usePriorityTasks';
import { supabase } from '@/integrations/supabase/client';
import { Element, Task, Status, User } from '@/types';

type ViewMode = 'list' | 'kanban' | 'gantt';

const Index = () => {
  const { user, signOut } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeChatTaskId, setActiveChatTaskId] = useState<string | null>(null);
  const [activeChatTab, setActiveChatTab] = useState<'comments' | 'attachments'>('comments');
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [showDeleteCompany, setShowDeleteCompany] = useState(false);
  const [showCreateElement, setShowCreateElement] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskElementId, setTaskElementId] = useState<string | null>(null);
  const [companyToEdit, setCompanyToEdit] = useState<string | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [statusesInitialized, setStatusesInitialized] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showStatusConfig, setShowStatusConfig] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [showEditElement, setShowEditElement] = useState(false);
  const [showDeleteElement, setShowDeleteElement] = useState(false);
  const [elementToEdit, setElementToEdit] = useState<string | null>(null);
  const [elementToDelete, setElementToDelete] = useState<string | null>(null);
  const [showWorkGroup, setShowWorkGroup] = useState(false);
  const [workGroupElementId, setWorkGroupElementId] = useState<string | null>(null);
  const [workGroupCounts, setWorkGroupCounts] = useState<Record<string, number>>({});
  const [isHomeView, setIsHomeView] = useState(true);

  const { companies, createCompany, updateCompany, deleteCompany } = useCompanies();
  const { projects, createProject, updateProject, deleteProject, duplicateProject } = useProjects(selectedCompanyId);
  const { elements, createElement, updateElement, deleteElement, duplicateElement, toggleExpand, reorderElements } = useElements(selectedProjectId);
  const { statuses, createDefaultStatuses, createStatus, updateStatus, deleteStatus, reorderStatuses, loading: statusesLoading } = useStatuses(selectedCompanyId);
  const { users: companyUsers } = useUsers(selectedCompanyId);
  const { notifications, unreadCount, markAsRead, markAllAsRead, requestPushPermission } = useNotifications(user?.id || null);
  
  // Favorites and My Work hooks
  const { favorites, toggleFavorite, isFavorite } = useElementFavorites(user?.id || null);
  const { elements: myWorkElements, loading: myWorkLoading } = useMyWork(user?.id || null);
  const { tasks: priorityTasks, loading: priorityTasksLoading } = usePriorityTasks(user?.id || null);
  const { elements: favoriteElementsDetails, loading: favoritesLoading } = useFavoriteElements(user?.id || null, favorites);
  
  const elementIds = useMemo(() => elements.map(e => e.id), [elements]);
  const { tasks, createTask, createSubtask, updateTask, deleteTask, bulkUpdateTasks, bulkDeleteTasks, reorderTasks, getSubtasks } = useTasks(elementIds);
  
  // Get all task IDs for comments
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { comments, addComment } = useComments(taskIds);

  // Get comment count for a specific task
  const getCommentCount = useCallback((taskId: string) => {
    return comments.filter(c => c.taskId === taskId).length;
  }, [comments]);

  // Check if user is supervisor
  useEffect(() => {
    const checkSupervisor = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'supervisor')
        .maybeSingle();
      console.log('Supervisor check:', { userId: user.id, data, error, isSupervisor: !!data });
      setIsSupervisor(!!data);
    };
    checkSupervisor();
  }, [user?.id]);

  // Auto-select company for non-supervisors
  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0 && !isSupervisor) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, isSupervisor, selectedCompanyId]);

  // Create default statuses if none exist (only once per company)
  useEffect(() => {
    if (
      selectedCompanyId && 
      !statusesLoading && 
      statuses.length === 0 && 
      statusesInitialized !== selectedCompanyId
    ) {
      setStatusesInitialized(selectedCompanyId);
      createDefaultStatuses();
    }
  }, [selectedCompanyId, statuses.length, statusesLoading, statusesInitialized, createDefaultStatuses]);

  const currentUser: User = {
    id: user?.id || '',
    name: user?.user_metadata?.full_name || user?.email || 'Usuário',
    email: user?.email || '',
    role: 'supervisor' as const,
    companyId: selectedCompanyId || '',
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Transform database elements to component format
  const projectElements: Element[] = elements.map(el => ({
    id: el.id,
    projectId: el.project_id,
    name: el.name,
    color: el.color,
    order: el.position,
    isExpanded: el.is_expanded ?? true,
  }));

  // Transform database tasks to component format
  const projectTasks: Task[] = tasks.map(t => ({
    id: t.id,
    elementId: t.element_id,
    name: t.name,
    description: t.description || undefined,
    estimatedValue: t.estimated_value || undefined,
    observation: t.observation || undefined,
    statusId: t.status_id || statuses[0]?.id || '1',
    startDate: t.start_date || undefined,
    endDate: t.end_date || undefined,
    createdAt: t.created_at,
    responsibleId: t.responsible_id || undefined,
    color: t.color,
    order: t.position,
    priority: t.priority || 0,
    isHidden: t.is_hidden || false,
    parentTaskId: t.parent_task_id || undefined,
  }));

  // Transform database statuses to component format
  const projectStatuses: Status[] = statuses.map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    importance: s.priority,
  }));

  // Transform company users to component format
  const allUsers: User[] = companyUsers.map(u => ({
    id: u.user_id,
    name: u.full_name || u.email,
    email: u.email,
    role: u.role as User['role'],
    companyId: selectedCompanyId || '',
    avatar: u.avatar_url || undefined,
  }));

  const activeChatTask = projectTasks.find(t => t.id === activeChatTaskId);

  // Fetch work group counts for all elements
  useEffect(() => {
    const fetchWorkGroupCounts = async () => {
      if (elementIds.length === 0) return;
      
      const { data } = await supabase
        .from('element_work_groups')
        .select('element_id')
        .in('element_id', elementIds);
      
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(item => {
          counts[item.element_id] = (counts[item.element_id] || 0) + 1;
        });
        setWorkGroupCounts(counts);
      }
    };
    
    fetchWorkGroupCounts();
  }, [elementIds]);

  const handleOpenWorkGroup = useCallback((elementId: string) => {
    setWorkGroupElementId(elementId);
    setShowWorkGroup(true);
  }, []);

  const handleOpenCreateTask = useCallback((elementId: string) => {
    setTaskElementId(elementId);
    setShowCreateTask(true);
  }, []);

  const handleAddTask = useCallback(async (name: string, color: string) => {
    if (!taskElementId) return;
    await createTask(taskElementId, name, color);
    setTaskElementId(null);
  }, [createTask, taskElementId]);

  const handleAddElement = useCallback(async (name: string, color: string) => {
    await createElement(name, color);
  }, [createElement]);

  const handleStatusChange = useCallback(async (taskId: string, statusId: string) => {
    await updateTask(taskId, { status_id: statusId });
  }, [updateTask]);

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    // Convert from component format to database format
    const dbUpdates: Record<string, unknown> = {};
    if ('name' in updates) dbUpdates.name = updates.name;
    if ('observation' in updates) dbUpdates.observation = updates.observation;
    if ('estimatedValue' in updates) dbUpdates.estimated_value = updates.estimatedValue;
    if ('startDate' in updates) dbUpdates.start_date = updates.startDate;
    if ('endDate' in updates) dbUpdates.end_date = updates.endDate;
    if ('responsibleId' in updates) dbUpdates.responsible_id = updates.responsibleId;
    if ('statusId' in updates) dbUpdates.status_id = updates.statusId;
    if ('priority' in updates) dbUpdates.priority = updates.priority;
    if ('isHidden' in updates) dbUpdates.is_hidden = updates.isHidden;
    
    await updateTask(taskId, dbUpdates as any);
  }, [updateTask]);

  const handleBulkUpdate = useCallback(async (taskIds: string[], updates: Partial<Task>) => {
    return await bulkUpdateTasks(taskIds, updates as any);
  }, [bulkUpdateTasks]);

  const handleBulkDelete = useCallback(async (taskIds: string[]) => {
    return await bulkDeleteTasks(taskIds);
  }, [bulkDeleteTasks]);

  const handleCreateSubtask = useCallback(async (parentId: string, name: string, color: string) => {
    await createSubtask(parentId, name, color);
  }, [createSubtask]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  const getSubtasksForTask = useCallback((parentTaskId: string): Task[] => {
    return getSubtasks(parentTaskId).map(t => ({
      id: t.id,
      elementId: t.element_id,
      name: t.name,
      description: t.description || undefined,
      estimatedValue: t.estimated_value || undefined,
      observation: t.observation || undefined,
      statusId: t.status_id || statuses[0]?.id || '1',
      startDate: t.start_date || undefined,
      endDate: t.end_date || undefined,
      createdAt: t.created_at,
      responsibleId: t.responsible_id || undefined,
      color: t.color,
      order: t.position,
      priority: t.priority || 0,
      isHidden: t.is_hidden || false,
      parentTaskId: t.parent_task_id || undefined,
    }));
  }, [getSubtasks, statuses]);

  const handleReorderElements = useCallback((activeId: string, overId: string) => {
    reorderElements(activeId, overId);
  }, [reorderElements]);

  const handleReorderTasks = useCallback((activeId: string, overId: string, newElementId?: string) => {
    reorderTasks(activeId, overId, newElementId);
  }, [reorderTasks]);

  const handleAddComment = useCallback(async (taskId: string, content: string, mentionedUserIds?: string[]) => {
    if (!user?.id) return;
    try {
      await addComment(taskId, content, user.id, mentionedUserIds);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  }, [addComment, user?.id]);

  const handleNotificationClick = useCallback((notification: { reference_id?: string | null; reference_type?: string | null }) => {
    // If the notification references a task comment, open the chat for that task
    if (notification.reference_type === 'task_comment' && notification.reference_id) {
      setActiveChatTaskId(notification.reference_id);
      setActiveChatTab('comments');
    }
  }, []);

  const handleSearchResult = useCallback(async (result: {
    type: 'project' | 'element' | 'task' | 'subtask' | 'comment';
    projectId?: string;
    elementId?: string;
    taskId?: string;
  }) => {
    // Navigate to the project if available
    if (result.projectId) {
      // Find company for this project
      const project = projects.find(p => p.id === result.projectId);
      if (project) {
        setSelectedCompanyId(project.company_id);
        setSelectedProjectId(project.id);
      } else {
        // Project might be from another company, fetch it
        const { data } = await supabase
          .from('projects')
          .select('company_id')
          .eq('id', result.projectId)
          .single();
        
        if (data) {
          setSelectedCompanyId(data.company_id);
          setSelectedProjectId(result.projectId);
        }
      }
    }

    // Open chat if task or comment
    if (result.taskId) {
      setActiveChatTaskId(result.taskId);
      setActiveChatTab('comments');
    } else if (result.type === 'task' && result.projectId) {
      // For tasks, we need to find the task id
      const task = tasks.find(t => t.id === result.taskId);
      if (task) {
        setActiveChatTaskId(task.id);
        setActiveChatTab('comments');
      }
    }
  }, [projects, tasks]);

  const handleNavigateHome = useCallback(() => {
    setIsHomeView(true);
    setSelectedProjectId(null);
  }, []);

  const handleNavigateMyWork = useCallback(() => {
    setIsHomeView(true);
    setSelectedProjectId(null);
  }, []);

  const handleSelectElementFromHome = useCallback((elementId: string, projectId: string, companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProjectId(projectId);
    setIsHomeView(false);
  }, []);

  const handleCreateCompany = async (name: string, color: string) => {
    const result = await createCompany(name, color);
    if (result) {
      setSelectedCompanyId(result.id);
    }
    return result;
  };

  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setSelectedProjectId(null);
  };

  const handleEditCompany = (companyId: string) => {
    setCompanyToEdit(companyId);
    setShowEditCompany(true);
  };

  const handleDeleteCompany = (companyId: string) => {
    setCompanyToDelete(companyId);
    setShowDeleteCompany(true);
  };

  const handleConfirmDelete = async (companyId: string) => {
    const success = await deleteCompany(companyId);
    if (success && selectedCompanyId === companyId) {
      setSelectedCompanyId(null);
      setSelectedProjectId(null);
    }
    return success;
  };

  const companyBeingEdited = companies.find(c => c.id === companyToEdit);
  const companyBeingDeleted = companies.find(c => c.id === companyToDelete);
  const projectBeingEdited = projects.find(p => p.id === projectToEdit);
  const projectBeingDeleted = projects.find(p => p.id === projectToDelete);
  const elementBeingEdited = elements.find(e => e.id === elementToEdit);
  const elementBeingDeleted = elements.find(e => e.id === elementToDelete);

  // Map projects to Sidebar format
  const sidebarProjects = projects.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    company_id: p.company_id,
  }));

  const handleEditProject = (projectId: string) => {
    setProjectToEdit(projectId);
    setShowEditProject(true);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteProject(true);
  };

  const handleConfirmDeleteProject = async (projectId: string) => {
    const success = await deleteProject(projectId);
    if (success && selectedProjectId === projectId) {
      setSelectedProjectId(null);
    }
    return success;
  };

  const handleDuplicateProject = async (projectId: string) => {
    await duplicateProject(projectId);
  };

  const handleEditElement = (elementId: string) => {
    setElementToEdit(elementId);
    setShowEditElement(true);
  };

  const handleDeleteElement = (elementId: string) => {
    setElementToDelete(elementId);
    setShowDeleteElement(true);
  };

  const handleDuplicateElement = async (elementId: string) => {
    await duplicateElement(elementId);
  };

  const handleUpdateElement = async (id: string, name: string, color: string) => {
    return await updateElement(id, { name, color });
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        projects={sidebarProjects}
        companies={companies}
        selectedProjectId={selectedProjectId}
        selectedCompanyId={selectedCompanyId}
        onSelectProject={(id) => {
          setSelectedProjectId(id);
          setIsHomeView(false);
        }}
        onSelectCompany={handleSelectCompany}
        onCreateProject={() => setShowCreateProject(true)}
        onCreateCompany={() => setShowCreateCompany(true)}
        onEditCompany={handleEditCompany}
        onDeleteCompany={handleDeleteCompany}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        onDuplicateProject={handleDuplicateProject}
        onOpenProfile={() => setShowProfile(true)}
        onOpenUsers={() => setShowUsers(true)}
        onOpenInvitations={() => setShowInvitations(true)}
        onOpenStatusConfig={() => setShowStatusConfig(true)}
        onNavigateHome={handleNavigateHome}
        onNavigateMyWork={handleNavigateMyWork}
        isHomeView={isHomeView && !selectedProjectId}
        isSupervisor={isSupervisor}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          currentUser={currentUser}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onRequestPushPermission={requestPushPermission}
          onNotificationClick={handleNotificationClick}
          onSearchResult={handleSearchResult}
          onSignOut={signOut}
        />
        
        {selectedProject ? (
          <>
            <ProjectHeader
              project={{ 
                id: selectedProject.id, 
                name: selectedProject.name, 
                color: selectedProject.color,
                companyId: selectedProject.company_id,
                createdAt: selectedProject.created_at,
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            
            <div className="flex-1 flex overflow-hidden">
              {viewMode === 'list' && (
                <ListView
                  elements={projectElements}
                  tasks={projectTasks}
                  statuses={projectStatuses}
                  users={allUsers}
                  onToggleExpand={toggleExpand}
                  onAddTask={handleOpenCreateTask}
                  onAddElement={() => setShowCreateElement(true)}
                  onOpenChat={(taskId, tab) => {
                    setActiveChatTaskId(taskId);
                    setActiveChatTab(tab || 'comments');
                  }}
                  onStatusChange={handleStatusChange}
                  onTaskUpdate={handleTaskUpdate}
                  onBulkUpdate={handleBulkUpdate}
                  onBulkDelete={handleBulkDelete}
                  onReorderElements={handleReorderElements}
                  onReorderTasks={handleReorderTasks}
                  onCreateSubtask={handleCreateSubtask}
                  onDeleteTask={handleDeleteTask}
                  getSubtasks={getSubtasksForTask}
                  onEditElement={handleEditElement}
                  onDeleteElement={handleDeleteElement}
                  onDuplicateElement={handleDuplicateElement}
                  onOpenWorkGroup={handleOpenWorkGroup}
                  workGroupCounts={workGroupCounts}
                  getCommentCount={getCommentCount}
                />
              )}
              
              {viewMode === 'kanban' && (
                <KanbanView
                  tasks={projectTasks}
                  elements={projectElements}
                  statuses={projectStatuses}
                  users={allUsers}
                  onTaskClick={setActiveChatTaskId}
                  onTaskUpdate={handleTaskUpdate}
                  onReorderTasks={reorderTasks}
                  onCreateTask={async (elementId, name, color, statusId) => {
                    const task = await createTask(elementId, name, color);
                    if (task && statusId) {
                      await updateTask(task.id, { status_id: statusId });
                    }
                  }}
                  onCreateSubtask={handleCreateSubtask}
                  getSubtasks={getSubtasksForTask}
                />
              )}
              
              {viewMode === 'gantt' && (
                <GanttView
                  elements={projectElements}
                  tasks={projectTasks}
                  statuses={projectStatuses}
                  onUpdateTask={(taskId, updates) => {
                    // Avoid sending/merging undefined, or we may accidentally clear the other date.
                    const dbUpdates: Record<string, unknown> = {};
                    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
                    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
                    return updateTask(taskId, dbUpdates as any);
                  }}
                />
              )}
              
              {activeChatTask && (
                <TaskChat
                  task={activeChatTask}
                  comments={comments}
                  users={allUsers}
                  currentUserId={currentUser.id}
                  onAddComment={handleAddComment}
                  onClose={() => setActiveChatTaskId(null)}
                  defaultTab={activeChatTab}
                />
              )}
            </div>
          </>
        ) : isHomeView ? (
          <HomeView
            myWorkElements={myWorkElements}
            favoriteElements={favoriteElementsDetails}
            priorityTasks={priorityTasks}
            onSelectElement={handleSelectElementFromHome}
            onSelectTask={(taskId, elementId, projectId, companyId) => {
              setSelectedCompanyId(companyId);
              setSelectedProjectId(projectId);
              setIsHomeView(false);
              setActiveChatTaskId(taskId);
              setActiveChatTab('comments');
            }}
            onToggleFavorite={toggleFavorite}
            favoriteIds={favorites}
            loading={myWorkLoading || favoritesLoading || priorityTasksLoading}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {companies.length === 0 
                  ? 'Crie sua primeira empresa'
                  : selectedCompanyId 
                    ? 'Selecione ou crie um projeto'
                    : 'Selecione uma empresa'
                }
              </h2>
              <p className="text-muted-foreground">
                {companies.length === 0 
                  ? 'Comece criando uma empresa na barra lateral'
                  : selectedCompanyId
                    ? 'Escolha um projeto na barra lateral ou crie um novo'
                    : 'Escolha uma empresa na barra lateral para começar'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      <CreateCompanyDialog
        open={showCreateCompany}
        onOpenChange={setShowCreateCompany}
        onSubmit={handleCreateCompany}
      />

      <CreateProjectDialog
        open={showCreateProject}
        onOpenChange={setShowCreateProject}
        onSubmit={createProject}
        companyName={selectedCompany?.name}
      />

      <EditCompanyDialog
        open={showEditCompany}
        onOpenChange={setShowEditCompany}
        company={companyBeingEdited || null}
        onSubmit={updateCompany}
      />

      <DeleteCompanyDialog
        open={showDeleteCompany}
        onOpenChange={setShowDeleteCompany}
        company={companyBeingDeleted || null}
        onConfirm={handleConfirmDelete}
      />

      <EditProjectDialog
        open={showEditProject}
        onOpenChange={setShowEditProject}
        project={projectBeingEdited ? { id: projectBeingEdited.id, name: projectBeingEdited.name, color: projectBeingEdited.color } : null}
        onSubmit={updateProject}
      />

      <DeleteProjectDialog
        open={showDeleteProject}
        onOpenChange={setShowDeleteProject}
        project={projectBeingDeleted ? { id: projectBeingDeleted.id, name: projectBeingDeleted.name } : null}
        onConfirm={handleConfirmDeleteProject}
      />

      <CreateElementDialog
        open={showCreateElement}
        onOpenChange={setShowCreateElement}
        onSubmit={handleAddElement}
      />

      <EditElementDialog
        open={showEditElement}
        onOpenChange={setShowEditElement}
        element={elementBeingEdited ? { id: elementBeingEdited.id, name: elementBeingEdited.name, color: elementBeingEdited.color } : null}
        onSubmit={handleUpdateElement}
      />

      <DeleteElementDialog
        open={showDeleteElement}
        onOpenChange={setShowDeleteElement}
        element={elementBeingDeleted ? { id: elementBeingDeleted.id, name: elementBeingDeleted.name } : null}
        onConfirm={deleteElement}
      />

      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        onSubmit={handleAddTask}
      />

      <ProfileDialog
        open={showProfile}
        onOpenChange={setShowProfile}
      />

      <UsersDialog
        open={showUsers}
        onOpenChange={setShowUsers}
        companyId={selectedCompanyId}
        isSupervisor={isSupervisor}
      />

      <InvitationsDialog
        open={showInvitations}
        onOpenChange={setShowInvitations}
        companyId={selectedCompanyId}
      />

      <StatusConfigDialog
        open={showStatusConfig}
        onOpenChange={setShowStatusConfig}
        statuses={statuses}
        onCreateStatus={createStatus}
        onUpdateStatus={updateStatus}
        onDeleteStatus={deleteStatus}
        onReorderStatuses={reorderStatuses}
      />

      {workGroupElementId && (
        <ElementWorkGroupDialog
          open={showWorkGroup}
          onOpenChange={setShowWorkGroup}
          elementId={workGroupElementId}
          elementName={elements.find(e => e.id === workGroupElementId)?.name || ''}
          companyUsers={allUsers}
        />
      )}
    </div>
  );
};

export default Index;