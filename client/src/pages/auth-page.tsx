import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Brain, Shield, FileText, Users } from "lucide-react";

const loginSchema = insertUserSchema.pick({ username: true, password: true });
const registerSchema = insertUserSchema.pick({ username: true, password: true }).extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("login");

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const onLogin = async (data: z.infer<typeof loginSchema>) => {
    try {
      await loginMutation.mutateAsync(data);
      navigate("/");
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const onRegister = async (data: z.infer<typeof registerSchema>) => {
    try {
      await registerMutation.mutateAsync({
        username: data.username,
        password: data.password,
      });
      navigate("/");
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-bpn-white via-bpn-grey to-bpn-white relative overflow-hidden">
      {/* Floating Liquid Elements Background */}
      <div className="floating-elements">
        <div className="absolute top-10 left-10 w-32 h-32 bg-bpn-turquoise opacity-20 rounded-full animate-bubble-float"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 bg-bpn-green opacity-15 rounded-full animate-bubble-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 left-1/3 w-20 h-20 bg-bpn-turquoise opacity-10 rounded-full animate-bubble-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Left Panel - Auth Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="liquid-bubble w-16 h-16 bg-gradient-to-br from-bpn-turquoise to-bpn-green rounded-full mx-auto mb-4 flex items-center justify-center">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-bpn-black mb-2">BPN AI Assistant</h1>
              <p className="text-bpn-black/70">Secure access to your intelligent assistant</p>
            </div>

            <Card className="liquid-glass-strong animate-morphing">
              <CardHeader>
                <CardTitle className="text-center text-bpn-black">Welcome Back</CardTitle>
                <CardDescription className="text-center text-bpn-black/70">
                  Sign in to your account or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2 liquid-glass">
                    <TabsTrigger value="login" className="data-[state=active]:bg-bpn-turquoise data-[state=active]:text-white">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="register" className="data-[state=active]:bg-bpn-turquoise data-[state=active]:text-white">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4">
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter your username"
                                  {...field}
                                  className="liquid-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Enter your password"
                                  {...field}
                                  className="liquid-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full bg-bpn-turquoise hover:bg-bpn-turquoise/80 text-white ripple-effect"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? "Signing in..." : "Sign In"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>

                  <TabsContent value="register" className="space-y-4">
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Choose a username"
                                  {...field}
                                  className="liquid-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Choose a password"
                                  {...field}
                                  className="liquid-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="Confirm your password"
                                  {...field}
                                  className="liquid-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full bg-bpn-turquoise hover:bg-bpn-turquoise/80 text-white ripple-effect"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Hero Section */}
        <div className="hidden lg:flex w-1/2 items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="liquid-bubble w-32 h-32 bg-gradient-to-br from-bpn-turquoise to-bpn-green rounded-full mx-auto mb-8 flex items-center justify-center">
              <Brain className="w-16 h-16 text-white" />
            </div>
            
            <h2 className="text-4xl font-bold text-bpn-black mb-6">
              Your Intelligent Assistant
            </h2>
            
            <p className="text-xl text-bpn-black/70 mb-8">
              Harness the power of AI to analyze documents, generate reports, and access BPN's knowledge base with unprecedented efficiency.
            </p>

            <div className="grid grid-cols-1 gap-6">
              <div className="liquid-glass rounded-xl p-6 animate-morphing">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-bpn-turquoise rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-bpn-black">Document Analysis</h3>
                    <p className="text-sm text-bpn-black/70">Process and extract insights from PDFs, DOCX, and more</p>
                  </div>
                </div>
              </div>

              <div className="liquid-glass rounded-xl p-6 animate-morphing" style={{ animationDelay: '1s' }}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-bpn-green rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-bpn-black">Secure & Private</h3>
                    <p className="text-sm text-bpn-black/70">Your data stays secure with enterprise-grade protection</p>
                  </div>
                </div>
              </div>

              <div className="liquid-glass rounded-xl p-6 animate-morphing" style={{ animationDelay: '2s' }}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-bpn-turquoise rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-bpn-black">BPN Knowledge</h3>
                    <p className="text-sm text-bpn-black/70">Access comprehensive BPN organizational knowledge</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
