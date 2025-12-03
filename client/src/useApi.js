import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { useMemo } from "react";

export const useApi = () => {
  const { getAccessTokenSilently } = useAuth0();
  const baseURL = import.meta.env.VITE_API_URL;

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: baseURL,
    });

    // Перехоплювач запитів: додає токен
    instance.interceptors.request.use(async (config) => {
      try {
        const token = await getAccessTokenSilently();
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        // Якщо юзер не залогінений, токен просто не додасться (для публічних роутів)
        console.log("User not authenticated or error getting token");
      }
      return config;
    });

    return instance;
  }, [getAccessTokenSilently, baseURL]);

  return api;
};