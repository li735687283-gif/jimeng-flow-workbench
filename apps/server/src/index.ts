import { createApp } from './app'
import { LOCAL_SERVER_HOST } from './security/localAccess'

const PORT = Number(process.env.PORT ?? 8787)
const app = createApp()

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
