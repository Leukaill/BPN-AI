import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, Settings } from "@/hooks/use-settings";
import { useKnowledgeBase } from "@/hooks/use-knowledge-base";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  Settings as SettingsIcon, 
  User, 
  Brain, 
  Palette, 
  Volume2, 
  Shield, 
  Database,
  Globe,
  Moon,
  Sun,
  Zap,
  FileText,
  Trash2,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  BookOpen,
  Loader2
} from "lucide-react";
import { useLocation } from "wouter";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { knowledge, stats, uploadMutation, deleteMutation, validateFile } = useKnowledgeBase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);

  // Database status query
  const { data: dbStatus, isLoading: dbStatusLoading } = useQuery({
    queryKey: ['/api/database/status'],
    queryFn: async () => {
      const response = await fetch('/api/database/status');
      if (!response.ok) throw new Error('Failed to fetch database status');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSettingChange = (key: keyof Settings, value: any) => {
    updateSetting(key, value);
    
    toast({
      title: "Settings Updated",
      description: `${key.charAt(0).toUpperCase() + key.slice(1)} has been updated.`
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'bpn-ai-settings.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Settings Exported",
      description: "Your settings have been downloaded as a JSON file."
    });
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          Object.keys(importedSettings).forEach(key => {
            updateSetting(key as keyof Settings, importedSettings[key]);
          });
          toast({
            title: "Settings Imported",
            description: "Your settings have been successfully imported."
          });
        } catch (error) {
          toast({
            title: "Import Failed",
            description: "Invalid settings file format.",
            variant: "destructive"
          });
        }
      };
      reader.readAsText(file);
    }
  };

  const handleKnowledgeUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const validation = validateFile(file);
    
    if (!validation.isValid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    try {
      await uploadMutation.mutateAsync({ file });
      toast({
        title: "Knowledge Added",
        description: `${file.name} has been successfully added to Denyse's knowledge base.`
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload knowledge base file.",
        variant: "destructive"
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleKnowledgeUpload(e.dataTransfer.files);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-bpn-grey via-white to-bpn-green/10 p-6">
      <div className="max-w-4xl mx-auto">
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
            <h1 className="text-3xl font-bold text-bpn-black flex items-center">
              <SettingsIcon className="text-bpn-turquoise mr-3" />
              Settings
            </h1>
          </div>
          <Badge variant="outline" className="text-bpn-turquoise">
            {user?.username}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Settings */}
          <LiquidGlass className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-bpn-black">
                  <User className="mr-2 text-bpn-turquoise" />
                  Profile
                </CardTitle>
                <CardDescription>Manage your account settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <div className="p-2 bg-bpn-grey/20 rounded text-sm">
                    {user?.username}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Badge variant="secondary">BPN Organization</Badge>
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

          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Settings */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Brain className="mr-2 text-bpn-turquoise" />
                    AI Assistant
                  </CardTitle>
                  <CardDescription>Configure AI behavior and responses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>AI Model</Label>
                      <Select
                        value={settings.aiModel}
                        onValueChange={(value) => handleSettingChange('aiModel', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                          <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                          <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Response Length</Label>
                      <Select
                        value={settings.responseLength}
                        onValueChange={(value) => handleSettingChange('responseLength', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Short</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="long">Long</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Creativity Level: {settings.temperature}</Label>
                    <Slider
                      value={[settings.temperature]}
                      onValueChange={(value) => handleSettingChange('temperature', value[0])}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-bpn-black/60">
                      <span>Conservative</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Appearance Settings */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Palette className="mr-2 text-bpn-turquoise" />
                    Appearance
                  </CardTitle>
                  <CardDescription>Customize the interface appearance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select
                        value={settings.theme}
                        onValueChange={(value) => handleSettingChange('theme', value)}
                      >
                        <SelectTrigger>
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
                              <Zap className="mr-2 w-4 h-4" />
                              System
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={settings.language}
                        onValueChange={(value) => handleSettingChange('language', value)}
                      >
                        <SelectTrigger>
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
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Audio & Voice Settings */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Volume2 className="mr-2 text-bpn-turquoise" />
                    Audio & Voice
                  </CardTitle>
                  <CardDescription>Configure audio and voice features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sound Effects</Label>
                      <p className="text-sm text-bpn-black/60">Enable UI sound effects</p>
                    </div>
                    <Switch
                      checked={settings.soundEnabled}
                      onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Voice Input</Label>
                      <p className="text-sm text-bpn-black/60">Enable voice-to-text input</p>
                    </div>
                    <Switch
                      checked={settings.voiceEnabled}
                      onCheckedChange={(checked) => handleSettingChange('voiceEnabled', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Notifications</Label>
                      <p className="text-sm text-bpn-black/60">Get notified about responses</p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
                    />
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Privacy & Security */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Shield className="mr-2 text-bpn-turquoise" />
                    Privacy & Security
                  </CardTitle>
                  <CardDescription>Manage your data and privacy settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Privacy Mode</Label>
                      <p className="text-sm text-bpn-black/60">Enhanced privacy for sensitive data</p>
                    </div>
                    <Switch
                      checked={settings.privacyMode}
                      onCheckedChange={(checked) => handleSettingChange('privacyMode', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-save Chats</Label>
                      <p className="text-sm text-bpn-black/60">Automatically save chat history</p>
                    </div>
                    <Switch
                      checked={settings.autoSave}
                      onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Retention (days): {settings.dataRetention}</Label>
                    <Slider
                      value={[settings.dataRetention]}
                      onValueChange={(value) => handleSettingChange('dataRetention', value[0])}
                      max={365}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-bpn-black/60">
                      <span>1 day</span>
                      <span>6 months</span>
                      <span>1 year</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Knowledge Base Training */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <BookOpen className="mr-2 text-bpn-turquoise" />
                    Denyse's Knowledge Base
                  </CardTitle>
                  <CardDescription>Train Denyse with your own documents and knowledge</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Knowledge Base Stats */}
                  {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-bpn-grey/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-bpn-turquoise">{stats.totalEntries}</div>
                        <div className="text-sm text-bpn-black/70">Knowledge Entries</div>
                      </div>
                      <div className="bg-bpn-grey/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-bpn-turquoise">
                          {Math.round(stats.totalSize / 1024)}KB
                        </div>
                        <div className="text-sm text-bpn-black/70">Total Content</div>
                      </div>
                      <div className="bg-bpn-grey/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-bpn-turquoise">
                          {Object.keys(stats.fileTypes).length}
                        </div>
                        <div className="text-sm text-bpn-black/70">File Types</div>
                      </div>
                    </div>
                  )}

                  {/* Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      dragActive
                        ? 'border-bpn-turquoise bg-bpn-turquoise/10'
                        : 'border-bpn-grey hover:border-bpn-turquoise/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-4">
                      <div className="w-16 h-16 bg-bpn-turquoise rounded-full mx-auto flex items-center justify-center">
                        <Upload className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-bpn-black">Import Training Data</h3>
                        <p className="text-bpn-black/70">
                          Upload documents to train Denyse with your knowledge
                        </p>
                      </div>
                      <div className="flex items-center justify-center space-x-4">
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('knowledge-upload')?.click()}
                          disabled={uploadMutation.isPending}
                        >
                          {uploadMutation.isPending ? (
                            <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 w-4 h-4" />
                          )}
                          Choose File
                        </Button>
                        <span className="text-sm text-bpn-black/70">or drag and drop</span>
                      </div>
                      <p className="text-xs text-bpn-black/50">
                        Supported: PDF, DOCX, DOC, TXT (max 10MB)
                      </p>
                    </div>
                  </div>

                  {/* Knowledge Base List */}
                  {knowledge.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-bpn-black">Your Knowledge Base</h4>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {knowledge.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 bg-bpn-grey/20 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <FileText className="w-5 h-5 text-bpn-turquoise" />
                              <div>
                                <div className="font-medium text-bpn-black">{entry.title}</div>
                                <div className="text-sm text-bpn-black/70">
                                  {entry.filename} • {Math.round(entry.content.length / 1024)}KB
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteKnowledge(entry.id, entry.title)}
                              disabled={deleteMutation.isPending}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
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
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Database className="mr-2 text-bpn-turquoise" />
                    Database Status
                  </CardTitle>
                  <CardDescription>Monitor your database connection and stats</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dbStatusLoading ? (
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 animate-spin text-bpn-turquoise" />
                      <span className="text-bpn-black/70">Checking database status...</span>
                    </div>
                  ) : dbStatus ? (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        {dbStatus.healthy ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium text-bpn-black">
                            {dbStatus.healthy ? 'Connected' : 'Connection Error'}
                          </div>
                          <div className="text-sm text-bpn-black/70">
                            Last checked: {new Date(dbStatus.lastChecked).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      
                      {dbStatus.healthy && dbStatus.stats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-bpn-grey/20 rounded-lg p-3">
                            <div className="text-xl font-bold text-bpn-turquoise">{dbStatus.stats.users}</div>
                            <div className="text-sm text-bpn-black/70">Users</div>
                          </div>
                          <div className="bg-bpn-grey/20 rounded-lg p-3">
                            <div className="text-xl font-bold text-bpn-turquoise">{dbStatus.stats.chats}</div>
                            <div className="text-sm text-bpn-black/70">Chats</div>
                          </div>
                          <div className="bg-bpn-grey/20 rounded-lg p-3">
                            <div className="text-xl font-bold text-bpn-turquoise">{dbStatus.stats.knowledgeBase}</div>
                            <div className="text-sm text-bpn-black/70">Knowledge Entries</div>
                          </div>
                        </div>
                      )}
                      
                      {!dbStatus.healthy && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-700">{dbStatus.error}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-bpn-black/70">Unable to check database status</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </LiquidGlass>

            {/* Settings Management */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <SettingsIcon className="mr-2 text-bpn-turquoise" />
                    Settings Management
                  </CardTitle>
                  <CardDescription>Export, import, and reset your settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center"
                      onClick={exportSettings}
                    >
                      <Download className="mr-2 w-4 h-4" />
                      Export Settings
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center"
                      onClick={() => document.getElementById('import-settings')?.click()}
                    >
                      <Upload className="mr-2 w-4 h-4" />
                      Import Settings
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full flex items-center justify-center text-red-600 hover:text-red-700"
                      onClick={handleResetSettings}
                    >
                      <Trash2 className="mr-2 w-4 h-4" />
                      Reset All
                    </Button>
                  </div>
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