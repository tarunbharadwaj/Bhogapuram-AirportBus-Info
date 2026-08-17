export class AdminController {
  constructor(serviceModel, sessions) {
    this.serviceModel = serviceModel;
    this.sessions = sessions;
  }

  login = (req, res) => {
    const token = this.sessions.login(req.body.pin);
    if (!token) return res.status(401).json({ error: 'Incorrect admin PIN.' });
    res.json({ token, service: this.serviceModel.getAll() });
  };

  updateService = (req, res) => {
    try {
      res.json(this.serviceModel.replace(req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}
