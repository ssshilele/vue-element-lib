import axios from 'axios'

const service = function (baseURL) {

  const service = axios.create({ baseURL });

  service.interceptors.request.use(
    config => config,
    error => Promise.reject(error)
  );

  service.interceptors.response.use(
    response => {
      if (typeof response.data === 'string' && response.data.includes('<html>')) {
        window.location.reload(true);
        return Promise.reject(response)
      }
      return response
    },
    error => {
      console.log(error);
      return Promise.reject(error)
    });

  return service
};

export default service
