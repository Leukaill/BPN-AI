import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Brain, Shield, FileText, Users, ArrowRight, Sparkles, Zap, Eye, EyeOff } from "lucide-react";

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
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-denyse-turquoise opacity-20 rounded-full animate-pulse-slow"></div>
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-denyse-green opacity-15 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-32 left-1/3 w-80 h-80 bg-denyse-turquoise opacity-10 rounded-full animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-denyse-turquoise rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-denyse-green rounded-full animate-bounce" style={{ animationDelay: '3s' }}></div>
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Left Panel - Auth Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-denyse-turquoise to-denyse-green rounded-full mx-auto mb-6 flex items-center justify-center shadow-2xl animate-pulse-glow">
                  <Brain className="w-10 h-10 text-white" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-denyse-green rounded-full flex items-center justify-center animate-bounce">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Denyse AI Assistant</h1>
              <p className="text-slate-300 text-lg">Secure access to your intelligent assistant</p>
            </div>

            {/* Auth Form Container */}
            <div className="relative">
              <Card className="glass-card border-0 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-denyse-turquoise/10 to-denyse-green/10"></div>
                
                <CardHeader className="relative z-10 text-center pb-4">
                  <CardTitle className="text-2xl text-white mb-2">
                    {isLogin ? "Welcome Back" : "Create Account"}
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    {isLogin ? "Sign in to your account" : "Join Denyse AI Assistant today"}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="relative z-10">
                  {/* Toggle Buttons */}
                  <div className="flex rounded-lg bg-slate-800/50 p-1 mb-6">
                    <button
                      onClick={() => setIsLogin(true)}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                        isLogin
                          ? 'bg-denyse-turquoise text-white shadow-lg transform scale-105'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => setIsLogin(false)}
                      className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
                        !isLogin
                          ? 'bg-denyse-turquoise text-white shadow-lg transform scale-105'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>

                  {/* Form Content */}
                  <div className="relative overflow-hidden">
                    {/* Login Form */}
                    <div className={`transform transition-all duration-500 ${
                      isLogin ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 absolute inset-0'
                    }`}>
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-200">Username</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your username"
                                    {...field}
                                    className="glass-input border-slate-600 text-white placeholder-slate-400"
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
                                <FormLabel className="text-slate-200">Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      placeholder="Enter your password"
                                      {...field}
                                      className="glass-input border-slate-600 text-white placeholder-slate-400 pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-denyse-turquoise to-denyse-green hover:from-denyse-turquoise/80 hover:to-denyse-green/80 text-white font-medium py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 group"
                            disabled={loginMutation.isPending}
                          >
                            {loginMutation.isPending ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Signing in...</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center space-x-2">
                                <span>Sign In</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </div>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </div>

                    {/* Register Form */}
                    <div className={`transform transition-all duration-500 ${
                      !isLogin ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 absolute inset-0'
                    }`}>
                      <Form {...registerForm}>
                        <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                          <FormField
                            control={registerForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-200">Username</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Choose a username"
                                    {...field}
                                    className="glass-input border-slate-600 text-white placeholder-slate-400"
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
                                <FormLabel className="text-slate-200">Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      placeholder="Choose a password"
                                      {...field}
                                      className="glass-input border-slate-600 text-white placeholder-slate-400 pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
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
                                <FormLabel className="text-slate-200">Confirm Password</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showConfirmPassword ? "text" : "password"}
                                      placeholder="Confirm your password"
                                      {...field}
                                      className="glass-input border-slate-600 text-white placeholder-slate-400 pr-10"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                                    >
                                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-denyse-turquoise to-denyse-green hover:from-denyse-turquoise/80 hover:to-denyse-green/80 text-white font-medium py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 group"
                            disabled={registerMutation.isPending}
                          >
                            {registerMutation.isPending ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Creating account...</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center space-x-2">
                                <span>Create Account</span>
                                <Zap className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                              </div>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Panel - Hero Section */}
        <div className="hidden lg:flex w-1/2 items-center justify-center p-8">
          <div className="max-w-lg text-center">
            <div className="relative mb-8">
              <div className="w-32 h-32 bg-gradient-to-br from-denyse-turquoise to-denyse-green rounded-full mx-auto flex items-center justify-center shadow-2xl animate-pulse-glow">
                <Brain className="w-16 h-16 text-white" />
              </div>
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-denyse-green rounded-full flex items-center justify-center animate-bounce">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <h2 className="text-5xl font-bold text-white mb-6 tracking-tight">
              Your Intelligent Assistant
            </h2>
            
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Harness the power of AI to analyze documents, generate reports, and access your organization's knowledge base with unprecedented efficiency.
            </p>

            <div className="space-y-6">
              <div className="glass-card p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-xl">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-denyse-turquoise rounded-lg flex items-center justify-center shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white text-lg">Document Analysis</h3>
                    <p className="text-slate-300">Process and extract insights from PDFs, DOCX, and more</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '1s' }}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-denyse-green rounded-lg flex items-center justify-center shadow-lg">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white text-lg">Secure & Private</h3>
                    <p className="text-slate-300">Your data stays secure with enterprise-grade protection</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 transform hover:scale-105 transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '2s' }}>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-denyse-turquoise rounded-lg flex items-center justify-center shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white text-lg">Denyse Knowledge</h3>
                    <p className="text-slate-300">Access comprehensive knowledge base and insights</p>
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
