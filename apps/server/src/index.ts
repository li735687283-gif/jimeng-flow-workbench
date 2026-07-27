import { createApp } from './app'
import { startParentWatchdog } from './parentWatchdog'
import { LOCAL_SERVER_HOST } from './security/localAccess'

const PORT = Number(process.env.PORT ?? 8787)
const webRoot = process.env.MOK_WEB_ROOT?.trim()
const app = createApp({ webRoot })

const parentPid = Number(process.env.MOK_PARENT_PID)
if (Number.isInteger(parentPid) && parentPid > 0) {
  startParentWatchdog({
    parentPid,
    onParentGone: async () => {
      app.log.info('父进程已退出，后端服务一并关闭')
      await app.close()
      process.exit(0)
    },
  })
}

const start = async () => {
  try {
    await app.listen({
      port: PORT,
      host: LOCAL_SERVER_HOST,
    })
    app.log.info(
      '即梦 Flow 后端监听 http://' + LOCAL_SERVER_HOST + ':' + PORT,
    )
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
