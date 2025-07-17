import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/use-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { 
  ArrowLeft, 
  Settings as SettingsIcon,
  Brain, 
  Palette, 
  Shield, 
  User, 
  BookOpen, 
  Database,
  Download,
  Upload,
  Trash2,
  Sun, 
  Moon, 
  Monitor,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { settings, updateSetting, resetSettings } = useSettings();
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);

  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
  });

  // Knowledge base queries
  const { data: knowledgeEntries } = useQuery({
    queryKey: ['/api/knowledge-base'],
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/knowledge-base/stats'],
  });

  const { data: dbStatus, isLoading: dbStatusLoading } = useQuery({
    queryKey: ['/api/database/status'],
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/knowledge-base/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete knowledge base entry');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/stats'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to logout');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation('/auth');
    },
  });

  const handleSettingChange = (key: string, value: any) => {
    updateSetting(key as any, value);
  };

  const handleKnowledgeUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      const response = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload knowledge base file');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/knowledge-base/stats'] });
      
      toast({
        title: "Knowledge Base Updated",
        description: "Your document has been successfully processed and added to the knowledge base.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteKnowledge = async (id: number, title: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: "Knowledge Deleted",
        description: `${title} has been removed from your knowledge base.`
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete knowledge base entry.",
        variant: "destructive"
      });
    }
  };

  const handleResetSettings = () => {
    resetSettings();
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to default values."
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'denyse-settings.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        Object.keys(importedSettings).forEach(key => {
          handleSettingChange(key, importedSettings[key]);
        });
        toast({
          title: "Settings Imported",
          description: "Settings have been successfully imported."
        });
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to import settings. Please check the file format.",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-denyse-grey via-white to-denyse-green/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="liquid-glass rounded-full p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold text-denyse-black dark:text-white flex items-center">
              <SettingsIcon className="text-denyse-turquoise mr-3" />
              Settings
            </h1>
          </div>
          <Badge variant="outline" className="text-denyse-turquoise">
            {user?.username}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* AI & Interface */}
          <div className="space-y-6">
            {/* AI Settings */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <Brain className="mr-2 text-denyse-turquoise w-5 h-5" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">AI Model</Label>
                    <Select
                      value={settings.aiModel}
                      onValueChange={(value) => handleSettingChange('aiModel', value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llama-3.1-8b">Llama 3.1 8B (Local)</SelectItem>
                        <SelectItem value="gemma-2-9b">Gemma 2 9B (Local)</SelectItem>
                        <SelectItem value="mistral-7b">Mistral 7B (Local)</SelectItem>
                        <SelectItem value="codellama-7b">CodeLlama 7B (Local)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Response</Label>
                      <Select
                        value={settings.responseLength}
                        onValueChange={(value) => handleSettingChange('responseLength', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="long">Long</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Creativity: {settings.temperature}</Label>
                      <Slider
                        value={[settings.temperature]}
                        onValueChange={(value) => handleSettingChange('temperature', value[0])}
                        max={1}
                        min={0}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Appearance */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <Palette className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm">Theme</Label>
                      <Select
                        value={settings.theme}
                        onValueChange={(value) => handleSettingChange('theme', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center">
                              <Sun className="mr-2 w-4 h-4" />
                              Light
                            </div>
                          </SelectItem>
                          <SelectItem value="dark">
                            <div className="flex items-center">
                              <Moon className="mr-2 w-4 h-4" />
                              Dark
                            </div>
                          </SelectItem>
                          <SelectItem value="system">
                            <div className="flex items-center">
                              <Monitor className="mr-2 w-4 h-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Language</Label>
                      <Select
                        value={settings.language}
                        onValueChange={(value) => handleSettingChange('language', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="rw">Kinyarwanda</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="sw">Kiswahili</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Sound</Label>
                      <Switch
                        checked={settings.soundEnabled}
                        onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Voice</Label>
                      <Switch
                        checked={settings.voiceEnabled}
                        onCheckedChange={(checked) => handleSettingChange('voiceEnabled', checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>
          </div>

          {/* Privacy & Account */}
          <div className="space-y-6">
            {/* Privacy & Security */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <Shield className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Privacy & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Privacy Mode</Label>
                      <Switch
                        checked={settings.privacyMode}
                        onCheckedChange={(checked) => handleSettingChange('privacyMode', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Auto-save</Label>
                      <Switch
                        checked={settings.autoSave}
                        onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Notifications</Label>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Data Retention: {settings.dataRetention} days</Label>
                    <Slider
                      value={[settings.dataRetention]}
                      onValueChange={(value) => handleSettingChange('dataRetention', value[0])}
                      max={365}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-denyse-black/60 dark:text-white/60">
                      <span>1d</span>
                      <span>6m</span>
                      <span>1y</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Profile & Account */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <User className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Profile & Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Username</Label>
                    <div className="p-2 bg-denyse-grey/20 dark:bg-slate-800 rounded text-sm">
                      {user?.username}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Account Type</Label>
                    <Badge variant="secondary">Organization</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => logoutMutation.mutate()}
                  >
                    Sign Out
                  </Button>
                </CardContent>
              </Card>
            </LiquidGlass>
          </div>

          {/* Data & System */}
          <div className="space-y-6">
            {/* Knowledge Base */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <BookOpen className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Knowledge Base
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Knowledge Base Stats */}
                  {stats && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-denyse-grey/20 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-lg font-bold text-denyse-turquoise">{stats.totalEntries}</div>
                        <div className="text-xs text-denyse-black/70 dark:text-white/70">Entries</div>
                      </div>
                      <div className="bg-denyse-grey/20 dark:bg-slate-800 rounded-lg p-3">
                        <div className="text-lg font-bold text-denyse-turquoise">
                          {Math.round(stats.totalSize / 1024)}KB
                        </div>
                        <div className="text-xs text-denyse-black/70 dark:text-white/70">Size</div>
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  <Button
                    onClick={() => document.getElementById('knowledge-upload')?.click()}
                    className="w-full"
                    variant="outline"
                  >
                    <Upload className="mr-2 w-4 h-4" />
                    Upload Document
                  </Button>

                  {/* Knowledge Base List */}
                  {knowledgeEntries && knowledgeEntries.length > 0 && (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {knowledgeEntries.slice(0, 3).map((entry: any) => (
                        <div key={entry.id} className="flex items-center justify-between p-2 bg-denyse-grey/10 dark:bg-slate-800 rounded">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-denyse-black dark:text-white truncate">
                              {entry.title}
                            </div>
                            <div className="text-xs text-denyse-black/60 dark:text-white/60">
                              {entry.fileType?.toUpperCase()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKnowledge(entry.id, entry.title)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    id="knowledge-upload"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={(e) => handleKnowledgeUpload(e.target.files)}
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Database Status */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <Database className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Database Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dbStatusLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-denyse-turquoise" />
                      <span className="text-sm text-denyse-black/70 dark:text-white/70">Checking...</span>
                    </div>
                  ) : dbStatus ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        {dbStatus.healthy ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <div className="text-sm font-medium text-denyse-black dark:text-white">
                          {dbStatus.healthy ? 'Connected' : 'Error'}
                        </div>
                      </div>
                      
                      {dbStatus.healthy && dbStatus.stats && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-denyse-grey/20 dark:bg-slate-800 rounded p-2">
                            <div className="text-sm font-bold text-denyse-turquoise">{dbStatus.stats.users}</div>
                            <div className="text-xs text-denyse-black/70 dark:text-white/70">Users</div>
                          </div>
                          <div className="bg-denyse-grey/20 dark:bg-slate-800 rounded p-2">
                            <div className="text-sm font-bold text-denyse-turquoise">{dbStatus.stats.chats}</div>
                            <div className="text-xs text-denyse-black/70 dark:text-white/70">Chats</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-denyse-black/70 dark:text-white/70">Unable to check</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Settings Management */}
            <LiquidGlass>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-denyse-black dark:text-white text-lg">
                    <SettingsIcon className="mr-2 text-denyse-turquoise w-5 h-5" />
                    Settings Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={exportSettings}
                    >
                      <Download className="mr-1 w-3 h-3" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => document.getElementById('import-settings')?.click()}
                    >
                      <Upload className="mr-1 w-3 h-3" />
                      Import
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-600 hover:text-red-700"
                    onClick={handleResetSettings}
                  >
                    <Trash2 className="mr-1 w-3 h-3" />
                    Reset All
                  </Button>
                  <input
                    id="import-settings"
                    type="file"
                    accept=".json"
                    onChange={importSettings}
                    className="hidden"
                  />
                </CardContent>
              </Card>
            </LiquidGlass>
          </div>
        </div>
      </div>
    </div>
  );
}