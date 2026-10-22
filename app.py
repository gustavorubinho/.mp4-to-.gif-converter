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

app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


def cortar_por_coordenadas(img, crop_x, crop_y, crop_w, crop_h):
    if crop_x is None or crop_w is None or crop_w <= 0 or crop_h <= 0:
        return img

    largura_total, altura_total = img.size

    esquerda = max(0, int(crop_x * largura_total))
    topo = max(0, int(crop_y * altura_total))
    direita = min(largura_total, int((crop_x + crop_w) * largura_total))
    baixo = min(altura_total, int((crop_y + crop_h) * altura_total))

    if direita > esquerda and baixo > topo:
        return img.crop((esquerda, topo, direita, baixo))
    return img


def video_para_gif(caminho_video, caminho_gif, inicio_segundos=0.0, duracao_segundos=5.0, 
                   crop_coords=None, fps=12, largura_max=480):
    """
    """
    leitor = imageio.get_reader(caminho_video)
    meta = leitor.get_meta_data()
    fps_original = meta.get('fps', 24) or 24

    passo = max(1, int(round(fps_original / fps)))
    frame_inicio = int(inicio_segundos * fps_original)
    frame_fim = frame_inicio + int(duracao_segundos * fps_original)

    frames_processados = []

    try:
        for indice, frame in enumerate(leitor):
            if indice < frame_inicio:
                continue

            if indice > frame_fim:
                break

            if (indice - frame_inicio) % passo == 0:
                img = Image.fromarray(frame)

                if crop_coords:
                    img = cortar_por_coordenadas(
                        img, 
                        crop_coords.get('x'), 
                        crop_coords.get('y'), 
                        crop_coords.get('w'), 
                        crop_coords.get('h')
                    )

                if img.width > largura_max:
                    proporcao = largura_max / float(img.width)
                    nova_altura = int(float(img.height) * proporcao)
                    img = img.resize((largura_max, nova_altura), Image.Resampling.LANCZOS)

                img = img.convert('P', palette=Image.Palette.ADAPTIVE, colors=256)
                frames_processados.append(img)
    finally:
        leitor.close()

    if not frames_processados:
        raise ValueError("Não foi possível extrair frames no trecho selecionado.")

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
        return jsonify({'erro': 'No video file uploaded.'}), 400

    arquivo_video = request.files['video']
    if arquivo_video.filename == '':
        return jsonify({'erro': 'No file selected.'}), 400

    try:
        inicio = max(0.0, float(request.form.get('start_time', 0.0)))
    except ValueError:
        inicio = 0.0

    try:
        duracao = float(request.form.get('duration', 5.0))
        duracao = max(2.0, min(8.0, duracao))
    except ValueError:
        duracao = 5.0

    crop_coords = None
    try:
        if 'crop_x' in request.form and 'crop_w' in request.form:
            crop_coords = {
                'x': float(request.form.get('crop_x')),
                'y': float(request.form.get('crop_y')),
                'w': float(request.form.get('crop_w')),
                'h': float(request.form.get('crop_h'))
            }
    except (ValueError, TypeError):
        crop_coords = None

    id_unico = str(uuid.uuid4())[:8]
    nome_video = f"{id_unico}_{arquivo_video.filename}"
    nome_gif = f"{id_unico}.gif"

    caminho_video = os.path.join(UPLOAD_FOLDER, nome_video)
    caminho_gif = os.path.join(OUTPUT_FOLDER, nome_gif)

    arquivo_video.save(caminho_video)

    try:
        video_para_gif(
            caminho_video, 
            caminho_gif, 
            inicio_segundos=inicio, 
            duracao_segundos=duracao, 
            crop_coords=crop_coords
        )

        return jsonify({
            'sucesso': True,
            'gif_url': f'/download/{nome_gif}',
            'inicio_usado': inicio,
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
    porta = int(os.environ.get('PORT', 5000))
    print(f"Servidor rodando em: http://127.0.0.1:{porta}")
    app.run(host='0.0.0.0', port=porta, debug=True)
