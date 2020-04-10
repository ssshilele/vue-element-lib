import request from '@/utils/request'

export function who (name) {
  return request({
    url: '/user/info',
    method: 'get',
    params: {
      name
    }
  })
}

export function sayHi (name, message) {
  return request({
    url: '/user/hello',
    method: 'post',
    data: {
      name,
      message
    }
  })
}
