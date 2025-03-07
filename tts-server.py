# server.py
from flask import Flask, request, send_file
from flask_cors import CORS  # 添加 CORS 支持
import edge_tts
import io
import asyncio

app = Flask(__name__)
CORS(app)  # 允许所有来源访问，生产环境可限制特定域名

def run_async(coro):
    """同步调用异步函数，确保线程安全"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@app.route('/tts', methods=['POST'])
def tts():
    try:
        data = request.get_json()
        text = data['text']
        voice = data['voice']
        
        # 创建 edge-tts 通信对象
        communicate = edge_tts.Communicate(text, voice)
        audio_bytes = io.BytesIO()
        
        # 同步运行异步生成音频流
        async def generate_audio():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_bytes.write(chunk["data"])
        
        run_async(generate_audio())
        audio_bytes.seek(0)
        
        # 返回音频数据
        return send_file(
            audio_bytes,
            mimetype='audio/mp3',
            as_attachment=False
        )
    except Exception as e:
        return {'error': str(e)}, 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=1066, threaded=True)