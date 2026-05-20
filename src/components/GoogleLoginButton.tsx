// GoogleLoginButton.tsx
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

export const GoogleLoginButton = () => {
  const { googleLogin } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <GoogleLogin
    
     onSuccess={async (credentialResponse) => {
  console.log("1. Google credential received:", credentialResponse);
  const token = credentialResponse.credential;
  if (token) {
    try {
      console.log("2. Sending token to backend...");
      const result = await googleLogin(token);
      console.log("3. Login successful, user:", result);
      setLocation("/");
    } catch (error) {
      console.error("4. Login failed:", error);
    }
  }
}}
      onError={() => {
        console.error("Google login failed");
      }}
      useOneTap={false}  // ✅ отключаем One Tap, чтобы не было конфликтов
      auto_select={false} // ✅ не выбираем аккаунт автоматически
    />
  );
};