from app import create_app

application = create_app()

if __name__ == '__main__':
    # El puerto 5000 es el predeterminado para Flask
    # debug=True habilita el modo de depuración, que es útil durante el desarrollo
    # host='0.0.0.0' hace que el servidor sea accesible desde otras máquinas en la red
    application.run(host='0.0.0.0', port=5000, debug=True)