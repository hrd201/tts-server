# tts-server
利用edge-tts项目部署服务，利用油猴插件实现chrome大声朗读功能

### 项目总结

#### 1. 项目概述
- **目标**：实现网页文字转语音功能，通过油猴脚本调用后端 TTS 服务。
- **成果**：
  - **前端**：油猴脚本 `Edge TTS Online Player v0.3.9`，支持播放选中文字和网页正文，包含暂停/继续和停止功能，界面紧凑位于左下角。
  - **后端**：在 VPS 上部署 TTS 服务，使用 Python 脚本 `tts-server.py`，通过 HTTPS 提供音频。

#### 2. VPS 部署
- **环境**：
  - 在 VPS 的 `/root` 目录下创建并配置 Python 虚拟环境，运行 `tts-server.py`。
- **网络配置**：
  - 使用 HTTPS，通过现有网站的反向代理实现。
  - 服务端一定要使用HTTPS否则无法识别https网页的字符。
- **技术栈**：
  - 前端：JavaScript（油猴脚本，依赖 `axios`）。
  - 后端：Python（Flask，依赖 `edge_tts` 和 `flask_cors`）。

#### 3. 安装与部署步骤
##### 3.1 安装 Python3 和基础工具
- **安装 Python3**：
  ```bash
  sudo apt update
  sudo apt install python3 -y
  ```
- **安装 pip**：
  ```bash
  sudo apt install python3-pip -y
  ```

##### 3.2 创建并配置虚拟环境
- **创建虚拟环境**：
  ```bash
  python3 -m venv /root/venv
  ```
- **激活虚拟环境**：
  ```bash
  source /root/venv/bin/activate
  ```
- **安装所需库**：
  ```bash
  pip install flask flask-cors edge-tts requests
  ```
- **退出虚拟环境**：
  ```bash
  deactivate
  ```

##### 3.3 部署 TTS 服务
- **上传代码**：
  - 将 `tts-server.py` 上传至 `/root`。
- **测试运行**：
  ```bash
  /root/venv/bin/python /root/tts-server.py
  ```
- **服务文件配置**：
  - 创建并编辑服务文件：
    ```bash
    sudo nano /etc/systemd/system/tts-server.service
    ```
  - 更新内容：
    ```ini
    [Unit]
    Description=TTS Server
    After=network.target

    [Service]
    ExecStart=/root/venv/bin/python /root/tts-server.py
    WorkingDirectory=/root
    Environment="PATH=/root/venv/bin:/usr/local/bin:/usr/bin:/bin"
    Restart=always
    RestartSec=5
    User=root

    [Install]
    WantedBy=multi-user.target
    ```
  - 保存并应用：
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl start tts-server
    sudo systemctl enable tts-server
    ```
- **验证服务**：
  ```bash
  sudo systemctl status tts-server
  ```
  - 确认状态为 `Active: active (running)`。

##### 3.4 网络配置
- **端口开放**：
  ```bash
  sudo ufw allow 1066
  ```
- **反向代理**：
  - 在现有 Nginx 配置中添加：
    ```nginx
    location /tts {
        proxy_pass http://localhost:1066; # 替换为实际端口
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    ```
  - 重启 Nginx：
    ```bash
    sudo systemctl restart nginx
    ```


```

#### 4. 前端代码（油猴脚本）
- 使用 `Edge TTS Online Player v0.3.9`，请求地址为 `https://[your-domain]/tts`（需在脚本中替换实际域名）：
  ```javascript
  const response = await axios.post('https://[your-domain]/tts', {  // 请替换为实际域名
      text: cleanedText,
      voice: voice
  }, {
      responseType: 'arraybuffer',
      timeout: 10000
  });
  ```

---

### 工作流
1. **用户操作**：
   - 在网页中使用油猴脚本，点击“选择”或“全文”。
2. **前端请求**：
   - 脚本发送 POST 请求到 `https://[your-domain]/tts`。
3. **后端处理**：
   - `server.py` 接收请求，使用 `edge_tts` 生成音频并返回。
4. **播放**：
   - 脚本接收音频并播放，支持暂停和停止。

---

### 当前状态
- **服务运行**：通过 systemd 成功启动 `tts-server.service`，状态为 `active (running)`。
- **网页访问**：油猴脚本已能正常连接服务并播放音频。

---

### 建议
1. **安全性**：
   - 限制 CORS：`CORS(app, origins='https://[your-domain]')`。
   - 检查 HTTPS 证书有效性。
2. **优化**：
   - 添加日志到 `tts-server.py`：
     ```python
     import logging
     logging.basicConfig(filename='/root/tts.log', level=logging.INFO)
     ```
   - 支持语速调整：修改 `edge_tts.Communicate` 参数。
3. **监控**：
   - 定期检查服务状态：
     ```bash
     sudo systemctl status tts-server
     ```
