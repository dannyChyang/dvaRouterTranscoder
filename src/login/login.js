import { routerRedux } from 'dva/router';
import { processCaptcha } from 'utils/utils';
import { accountLogin, refreshCaptcha } from 'services/api';

const getLoginError = (payload, status) => {
  if (status === 10004) return '用户名或密码错误';
  if (status === 10006 && payload.cap) return '验证码输入错误';
  if (status === 10007 && payload.cap) return '验证码超时';
  if (status === 20076) return '子账号已停用，请联系您的客户经理';
  return '';
};

export default {
  namespace: 'login',

  state: {},

  effects: {
    *login({ payload, cb }, { call, put }) {
      try {
        const result = yield call(accountLogin, payload);
        if (result) {
          const { token, captcha, status } = result;
          // 登录成功
          if (token) {
            yield put({
              type: 'changeLoginStatus',
              payload: {
                error: null,
                captcha: null,
              },
            });
            yield put({
              type: 'global/saveToken',
              payload: token,
            });
            yield put(routerRedux.push('/'));
          } else {
            // 登录失败
            if (captcha) {
              // 开始倒计时 倒计时结束之后 去取验证码
              // 只有在出现二维码之后 才开启这个倒计时功能
              cb();
            }
            yield put({
              type: 'changeLoginStatus',
              payload: {
                error: getLoginError(payload, status),
                captcha: captcha && processCaptcha(captcha),
              },
            });
          }
        }
      } catch (error) {
        console.error(error); // eslint-disable-line
        yield put({
          type: 'changeLoginStatus',
          payload: {
            error: '登录失败，发生未知错误',
            captcha: null,
          },
        });
      }
    },
    *getCaptcha({ cb }, { call, put }) {
      try {
        const captcha = yield call(refreshCaptcha);
        if (captcha) {
          cb(); // 开始倒计时
          yield put({
            type: 'refreshCaptcha',
            payload: {
              captcha: processCaptcha(captcha),
            },
          });
        }
      } catch (error) {
        yield put({
          error: '刷新验证码失败',
        });
      }
    },
  },

  reducers: {
    changeLoginStatus(state, { payload }) {
      return {
        ...state,
        error: payload.error,
        type: payload.type,
        captcha: payload.captcha,
      };
    },
    refreshCaptcha(state, { payload }) {
      return {
        ...state,
        captcha: payload.captcha,
      };
    },
  },
};