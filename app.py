import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from PIL import Image
import imageio

app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
OUTPUT_FOLDER = os.path.join(BASE_DIR, 'outputs')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024  * 1024

def video_para_gif(caminho_video, caminho_gif, duracao_segundos=5.0, fps=12, largura_max=480):

    leitor = imageio.get_reader(caminho_video)
    meta = leitor.get_meta_data()
    fps_original = meta.get('fps', 24) or 24

    passo = max(1, int(round(fps_original / fps)))
    max_frames_leitura = int(duracao_segundos * fps_original)

    frames_processados = []

    try:
        for indice, frame in enumerate(leitor):
            if indice > max_frames_leitura:
                break
            if indice % passo == 0:
                img = Image.fromarray(frame)
                if img.width > largura_max:
                    proporcao = largura_max / float(img.width)
                    nova_altura = int(float(img.height) * proporcao)
                    img = img.resize((largura_max, nova_altura), Image.Resampling.LANCZOS)
                img = img.convert('P', palette=Image.Palette.ADAPTIVE, colors=256)
                frames_processados.append(img)
    finally:
        leitor.close()

    if not frames_processados:
        raise ValueError("Não foi possível extrair nenhum frame do vídeo enviado.")
    duracao_frame_ms = max(20, int(1000 / fps))
    frames_processados[0].save(
        caminho_gif,
        save_all=True,
        append_images=frames_processados[1:],
        optimize=True,
        duration=duracao_frame_ms,
        loop=0
    )
    return caminho_gif

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def converter():
    if 'video' not in request.files:
        return jsonify({'erro': 'Nenhum vídeo foi enviado.'}), 400

    arquivo_video = request.files['video']
    if arquivo_video.filename == '':
        return jsonify({'erro': 'Nenhum arquivo selecionado.'}), 400

    try:
        duracao = float(request.form.get('duration', 5.0))
        duracao = max(2.0, min(8.0, duracao))
    except ValueError:
        duracao = 5.0

    id_unico = str(uuid.uuid4())[:8]
    nome_video = f"{id_unico}_{arquivo_video.filename}"
    nome_gif = f"{id_unico}.gif"

    caminho_video = os.path.join(UPLOAD_FOLDER, nome_video)
    caminho_gif = os.path.join(OUTPUT_FOLDER, nome_gif)
    arquivo_video.save(caminho_video)

    try:
        video_para_gif(caminho_video, caminho_gif, duracao_segundos=duracao)
        return jsonify({
            'sucesso': True,
            'gif_url': f'/download/{nome_gif}',
            'duracao_usada': duracao
        })
    except Exception as e:
        return jsonify({'erro': str(e)}), 500
    finally:
        if os.path.exists(caminho_video):
            try:
                os.remove(caminho_video)
            except Exception:
                pass

@app.route('/download/<nome_arquivo>')
def baixar_gif(nome_arquivo):
    return send_from_directory(OUTPUT_FOLDER, nome_arquivo)

if __name__ == '__main__':
    print("Servidor rodando em: http://127.0.0.1:5000")
    app.run(debug=True, port=5000)