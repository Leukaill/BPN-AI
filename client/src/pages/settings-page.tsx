import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings, Settings } from "@/hooks/use-settings";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  ArrowLeft
} from "lucide-react";
import { useLocation } from "wouter";

export default function SettingsPage() {
  const { user, logoutMutation } = useAuth();
  const { settings, updateSetting, resetSettings } = useSettings();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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

            {/* Data Management */}
            <LiquidGlass>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-bpn-black">
                    <Database className="mr-2 text-bpn-turquoise" />
                    Data Management
                  </CardTitle>
                  <CardDescription>Import, export, and manage your data</CardDescription>
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